import { parse, contactSchema, subscribeSchema, unsubscribeSchema } from '../validation.js';

export async function submitContact(input, { Contact, brevo }) {
  const data = parse(contactSchema, input);
  if (data.website) return { status: 200, body: { ok: true, message: 'Thanks. Your message has been received.' } };
  const record = await Contact.create({ name: data.name, email: data.email, message: data.message });
  try {
    const response = await brevo.sendContact(data);
    record.notificationStatus = 'sent';
    record.brevoMessageId = response.messageId || '';
    await record.save();
    return { status: 201, body: { ok: true, message: 'Your message was sent.' } };
  } catch {
    record.notificationStatus = 'failed';
    record.notificationError = 'Brevo notification failed';
    await record.save();
    return { status: 503, body: { ok: false, error: "Your message was saved, but we couldn't confirm that the email notification reached us." } };
  }
}

export async function subscribe(input, { Subscriber, brevo }) {
  const data = parse(subscribeSchema, input);
  if (data.website) return { status: 200, body: { ok: true, message: 'Thanks for signing up.' } };
  let record = await Subscriber.findOne({ email: data.email });
  if (record?.status === 'unsubscribed' || record?.status === 'unsubscribe_pending') {
    return { status: 409, body: { ok: false, error: 'This address previously unsubscribed. Contact us if you want to rejoin.' } };
  }
  let alreadySubscribed = record?.status === 'subscribed';
  if (!record) {
    try {
      record = await Subscriber.create({ email: data.email, consent: true, consentAt: new Date(), status: 'pending' });
    } catch (error) {
      if (error.code !== 11000) throw error;
      record = await Subscriber.findOne({ email: data.email });
      alreadySubscribed = record?.status === 'subscribed';
      if (record?.status === 'unsubscribed' || record?.status === 'unsubscribe_pending') return { status: 409, body: { ok: false, error: 'This address previously unsubscribed. Contact us if you want to rejoin.' } };
    }
  }
  try {
    await brevo.addSubscriber(data.email);
    record.status = 'subscribed';
    record.subscribedAt = new Date();
    record.lastIntegrationError = '';
    await record.save();
    return { status: alreadySubscribed ? 200 : 201, body: { ok: true, message: alreadySubscribed ? 'This email address is already subscribed to Dagger & Bone Apothecary updates.' : "You're subscribed to Dagger & Bone Apothecary updates." } };
  } catch (error) {
    record.status = error.status === 409 ? 'unsubscribed' : alreadySubscribed ? 'subscribed' : 'integration_error';
    if (error.status === 409) record.unsubscribedAt = new Date();
    record.lastIntegrationError = error.status === 409 ? 'Brevo address is unsubscribed' : 'Brevo synchronization failed';
    await record.save();
    return { status: error.status === 409 ? 409 : 503, body: { ok: false, error: error.status === 409 ? 'This address previously unsubscribed. Contact us if you want to rejoin.' : "We couldn't confirm your subscription. Please try again later." } };
  }
}

export async function unsubscribe(input, { Subscriber, brevo }) {
  const data = parse(unsubscribeSchema, input);
  if (data.website) return { status: 200, body: { ok: true, message: 'Your request has been received.' } };
  const record = await Subscriber.findOne({ email: data.email });
  if (!record || record.status === 'unsubscribed') return { status: 200, body: { ok: true, message: 'This email address is no longer subscribed to Dagger & Bone Apothecary updates.' } };
  record.status = 'unsubscribe_pending';
  await record.save();
  try {
    await brevo.removeSubscriber(data.email);
    record.status = 'unsubscribed';
    record.unsubscribedAt = new Date();
    record.lastIntegrationError = '';
    await record.save();
    return { status: 200, body: { ok: true, message: 'This email address is no longer subscribed to Dagger & Bone Apothecary updates.' } };
  } catch {
    record.lastIntegrationError = 'Brevo unsubscribe failed';
    await record.save();
    return { status: 503, body: { ok: false, error: "Your unsubscribe request was saved, but we couldn't confirm it with our email service. Please try again later." } };
  }
}
