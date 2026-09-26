import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readConfig } from './config.js';
import { User } from './models.js';
import { email as emailSchema, parse } from './validation.js';

const config = readConfig();
if (!config.mongoUri) throw new Error('MONGODB_URI is required');
const emailArg = process.argv.indexOf('--email');
let ownerEmail = emailArg >= 0 ? process.argv[emailArg + 1] : process.env.OWNER_EMAIL;
if (!ownerEmail) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  ownerEmail = await rl.question('Owner email: ');
  rl.close();
}
ownerEmail = parse(emailSchema, ownerEmail);

async function hiddenQuestion(label) {
  if (!stdin.isTTY) throw new Error('Set OWNER_PASSWORD in a private environment variable when running without a terminal');
  stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (buffer) => {
      for (const byte of buffer) {
        if (byte === 3) { cleanup(); reject(new Error('Cancelled')); return; }
        if (byte === 13 || byte === 10) { stdout.write('\n'); cleanup(); resolve(value); return; }
        if (byte === 127 || byte === 8) { value = value.slice(0, -1); continue; }
        value += String.fromCharCode(byte);
      }
    };
    const cleanup = () => { stdin.off('data', onData); stdin.setRawMode(false); stdin.pause(); };
    stdin.on('data', onData);
  });
}
const password = process.env.OWNER_PASSWORD || await hiddenQuestion('New password (hidden): ');
if (!process.env.OWNER_PASSWORD) {
  const confirm = await hiddenQuestion('Confirm password (hidden): ');
  if (password !== confirm) throw new Error('Passwords did not match');
}
if (password.length < 12) throw new Error('Use a password with at least 12 characters');
const passwordHash = await bcrypt.hash(password, 12);
try {
  await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, serverSelectionTimeoutMS: 10000 });
  await User.updateOne({ email: ownerEmail }, { $set: { email: ownerEmail, passwordHash, role: 'owner', active: true } }, { upsert: true });
  console.log(`Owner account ready for ${ownerEmail}.`);
} finally { await mongoose.disconnect(); }
