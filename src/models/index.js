// src/models/index.js
import mongoose from 'mongoose';

// ─── Guild Settings ────────────────────────────────────────────────────────────
const guildSchema = new mongoose.Schema({
  guildId:  { type: String, required: true, unique: true },
  prefix:   { type: String, default: '!' },
  language: { type: String, default: 'EN', enum: ['EN'] },

  // Welcome / Goodbye
  welcome: {
    enabled:       { type: Boolean, default: false },
    channelId:     String,
    message:       { type: String, default: 'Welcome {user} to **{server}**! 🎉 You are member #{memberCount}.' },
    embedEnabled:  { type: Boolean, default: true },
    embedColor:    { type: String, default: '#F5C542' },
    embedImage:    String,    // banner image URL
    dmMessage:     String,    // optional DM on join
    autoroles:     [String],
    autoroleDelay: { type: Number, default: 0 },
  },
  goodbye: {
    enabled:   { type: Boolean, default: false },
    channelId: String,
    message:   { type: String, default: '**{username}** has left **{server}**. Goodbye! 👋' },
    embedEnabled: { type: Boolean, default: false },
    embedColor:   { type: String, default: '#ED4245' },
  },

  // Automod
  automod: {
    enabled:     { type: Boolean, default: false },
    logChannelId: String,
    punishment:  { type: String, default: 'warn', enum: ['warn', 'mute', 'kick', 'ban'] },
    muteDuration: { type: Number, default: 10 }, // minutes
    antiSpam:    { enabled: { type: Boolean, default: false }, threshold: { type: Number, default: 5 }, interval: { type: Number, default: 5000 } },
    antiLinks:   { enabled: { type: Boolean, default: false }, whitelist: [String] },
    antiInvites: { enabled: { type: Boolean, default: false } },
    antiCaps:    { enabled: { type: Boolean, default: false }, threshold: { type: Number, default: 70 } },
    badWords:    { enabled: { type: Boolean, default: false }, words: [String] },
    immuneRoles:    [String],
    immuneChannels: [String],
  },

  // Anti-Raid
  antiraid: {
    enabled:     { type: Boolean, default: false },
    threshold:   { type: Number, default: 10 },
    interval:    { type: Number, default: 10000 },
    action:      { type: String, default: 'kick', enum: ['kick', 'ban', 'lockdown'] },
    logChannelId: String,
  },

  // Logs
  logs: {
    enabled:   { type: Boolean, default: false },
    channelId: String,
    events: {
      messageDelete:  { type: Boolean, default: true },
      messageEdit:    { type: Boolean, default: true },
      memberJoin:     { type: Boolean, default: true },
      memberLeave:    { type: Boolean, default: true },
      memberBan:      { type: Boolean, default: true },
      roleUpdate:     { type: Boolean, default: false },
      voiceUpdate:    { type: Boolean, default: false },
      modActions:     { type: Boolean, default: true },
    },
  },

  // Reaction Roles
  // (stored separately in ReactionRole collection)

  // Suggestions
  suggestions: {
    enabled:       { type: Boolean, default: false },
    channelId:     String,
    threadEnabled: { type: Boolean, default: true },
    dmResult:      { type: Boolean, default: true }, // DM submitter with result
  },

  // Polls channel (optional dedicated channel)
  polls: {
    channelId: String,
  },

  // Giveaways
  // (stored separately in Giveaway collection)

  // Embed Templates
  embedTemplates: [{
    name:      String,
    data:      mongoose.Schema.Types.Mixed,
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
  }],

  // Auto Voice Channels
  autoChannels: [{
    triggerId:    String,
    categoryId:   String,
    nameTemplate: { type: String, default: "{user}'s Channel" },
    userLimit:    { type: Number, default: 0 },
  }],

  // Custom Commands
  customCommands: [{
    name:      String,
    response:  String,
    useEmbed:  { type: Boolean, default: false },
    color:     { type: String, default: '#5865F2' },
    createdBy: String,
    uses:      { type: Number, default: 0 },
  }],

  updatedAt: { type: Date, default: Date.now },
});

// ─── Member (warns only — no XP) ──────────────────────────────────────────────
const memberSchema = new mongoose.Schema({
  userId:  { type: String, required: true },
  guildId: { type: String, required: true },
  warns: [{
    id:          String,
    reason:      String,
    moderatorId: String,
    timestamp:   { type: Date, default: Date.now },
  }],
});
memberSchema.index({ userId: 1, guildId: 1 }, { unique: true });

// ─── Temp Actions (bans / mutes) ──────────────────────────────────────────────
const tempActionSchema = new mongoose.Schema({
  guildId:     String,
  userId:      String,
  type:        { type: String, enum: ['ban', 'mute'] },
  expiresAt:   Date,
  reason:      String,
  moderatorId: String,
});

// ─── Reaction Roles ────────────────────────────────────────────────────────────
const reactionRoleSchema = new mongoose.Schema({
  guildId:       String,
  channelId:     String,
  messageId:     String,
  title:         String,
  description:   String,
  color:         { type: String, default: '#F5C542' },
  mode:          { type: String, default: 'multiple', enum: ['unique', 'multiple', 'toggle', 'temp'] },
  tempDuration:  Number,       // minutes
  useSelect:     { type: Boolean, default: false },
  requiredRoles: [String],
  blacklistRoles:[String],
  options: [{
    emoji:       String,
    label:       String,
    description: String,
    roleId:      String,
  }],
});

// ─── Giveaways ─────────────────────────────────────────────────────────────────
const giveawaySchema = new mongoose.Schema({
  guildId:      String,
  channelId:    String,
  messageId:    String,
  prize:        String,
  description:  String,
  winnersCount: { type: Number, default: 1 },
  endsAt:       Date,
  hostedBy:     String,
  participants: [String],
  ended:        { type: Boolean, default: false },
  winners:      [String],
  requiredRole: String,
  bonusEntries: [{ roleId: String, multiplier: Number }],
});

// ─── Temp Voice Channels ───────────────────────────────────────────────────────
const tempChannelSchema = new mongoose.Schema({
  guildId:   String,
  channelId: String,
  ownerId:   String,
  triggerId: String,
});

export const Guild       = mongoose.model('Guild',       guildSchema);
export const Member      = mongoose.model('Member',      memberSchema);
export const TempAction  = mongoose.model('TempAction',  tempActionSchema);
export const ReactionRole= mongoose.model('ReactionRole',reactionRoleSchema);
export const Giveaway    = mongoose.model('Giveaway',    giveawaySchema);
export const TempChannel = mongoose.model('TempChannel', tempChannelSchema);

// ─── Helpers ───────────────────────────────────────────────────────────────────
export async function getGuild(guildId) {
  return Guild.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function getMember(userId, guildId) {
  return Member.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
