require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const eventHandler = require('./handlers/eventHandler');
const Player = require('./models/Player');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});


const tiersData = require("./../rankings.json");



const PREFIX = '!';

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (command !== 'win') return;

  const winner = message.author;
  const loserUser = message.mentions.users.first();

  if (!loserUser || winner.id === loserUser.id) {
    return message.reply('Please mention a valid opponent (not yourself).');
  }

  const channel = message.channel;
  await channel.send(
    `🏆 ${winner} claims victory over ${loserUser}!\n\n${loserUser}, did you just lose to ${winner}? Type **yes** or **no** in this channel within **4 days**.`
  );

  const filter = (msg) =>
    msg.author.id === loserUser.id &&
    ['yes', 'no'].includes(msg.content.toLowerCase());

  const collector = channel.createMessageCollector({
    filter,
    time: 4 * 24 * 60 * 60 * 1000,
  });

  let responded = false;

  collector.on('collect', async (msg) => {
    responded = true;
    collector.stop();

    const reply = msg.content.toLowerCase();

    if (reply === 'yes') {
      // Fetch or create player data
      const winnerData =
        (await Player.findOne({ userId: winner.id })) ||
        new Player({ userId: winner.id, username: winner.username });
      const loserData =
        (await Player.findOne({ userId: loserUser.id })) ||
        new Player({ userId: loserUser.id, username: loserUser.username});
        console.log(winnerData);
        console.log(loserData);
      // --- Determine tiers ---
      const oldWinnerTier = getTierByElo(winnerData.elo);
      const oldLoserTier = getTierByElo(loserData.elo);

      if (!oldWinnerTier || !oldLoserTier) {
        await channel.send(
          `⚠️ Could not determine one or both players' current tiers. Please check rankings.json ranges.`
        );
        return;
      }

      const winnerTierIndex = getTierIndex(oldWinnerTier.roleId);
      const loserTierIndex = getTierIndex(oldLoserTier.roleId);
      const tierDiff = winnerTierIndex - loserTierIndex;


      const winnerRoleName =
        message.guild.roles.cache.get(oldWinnerTier.roleId)?.name || 'Unknown Tier';
      const loserRoleName =
        message.guild.roles.cache.get(oldLoserTier.roleId)?.name || 'Unknown Tier';

      // --- ELO gain/loss logic ---
      let winnerGain = 25;
      let loserLoss = 25;
      let diffSummary = "Same Tier Match";

      if (tierDiff > 0) {
        if (tierDiff === 1) {
          winnerGain = 30;
          loserLoss = 20;
          diffSummary = `Winner was 1 tier lower → Bonus ELO!`;
        } else if (tierDiff >= 2) {
          winnerGain = 35;
          loserLoss = 15;
          diffSummary = `Winner was ${tierDiff} tiers lower → Massive bonus!`;
        }
      } else if (tierDiff < 0) {
        if (tierDiff === -1) {
          winnerGain = 20;
          loserLoss = 30;
          diffSummary = `Winner was 1 tier higher → Reduced gain.`;
        } else if (tierDiff <= -2) {
          winnerGain = 15;
          loserLoss = 35;
          diffSummary = `Winner was ${Math.abs(tierDiff)} tiers higher → Minimal gain.`;
        }
      }

      // --- Apply ELO changes ---
      winnerData.wins += 1;
      loserData.losses += 1;
      winnerData.elo += winnerGain;
      loserData.elo -= loserLoss;

      await winnerData.save();
      await loserData.save();

      const winnerChange = await updatePlayerTier(message, winner, winnerData.elo, oldWinnerTier);
      const loserChange = await updatePlayerTier(message, loserUser, loserData.elo, oldLoserTier);

      await channel.send(
        `✅ **Match Confirmed!**\n\n**${winner}** (+${winnerGain} → ${winnerData.elo}) ${winnerChange}\n**${loserUser}** (-${loserLoss} → ${loserData.elo}) ${loserChange}\n\n📊 ${diffSummary}`
      );
    } else {
      // Dispute
      const adminUserId = process.env.ADMIN_USERID;

      const taunts = [ "💀 Bro’s ELO dropped harder than crypto in 2022.", "😭 I haven't seen a loss this bad since dial-up internet.", "🧱 Built like a lag spike and still blaming Wi-Fi.", "🎮 Controller must’ve been unplugged, right?", "💤 Bro played like his keyboard was in sleep mode.", "🤖 Even ChatGPT could’ve done better with random inputs.", "🥴 That loss was so bad, NASA picked it up on radar.", "🪦 ELO funeral in progress, please pay your respects.", "🔥 This man just redefined *what a downfall looks like.*", "🧊 The choke was colder than Antarctica.", "📉 Stock market crashes slower than this man’s aim.", "🦴 Bro folded like a lawn chair in a hurricane.", "💡 Maybe try turning skill settings from ‘Demo’ to ‘Human.’", "⚰️ Career ended live on Discord.", "🫡 Rest in peace, that confidence you had before the match.", "🪫 Skill battery: 0%. Plug in before queuing again.", "🎯 Missed every shot like it was part of the strategy.", "🚫 Aim assist left the chat.", "🥶 That gameplay was colder than your ex’s heart.", "💀 That wasn’t a match, that was a crime scene.", "🕯️ Lighting a candle for the ELO that just passed away.", "👻 Even ghosts have better reflexes.", "📞 Mom said it’s your turn to touch grass.", "🎢 That ELO drop had more loops than a rollercoaster.", "🐢 Movement so slow, I thought you were buffering IRL.", "🧍 The definition of a standing target.", "🧠 Brain.exe stopped responding mid-fight.", "💫 You didn’t just lose, you gave a masterclass in how to lose.", "🪄 Magically turned a win into a loss — Houdini level stuff.", "📦 Packwatch on your rank 📦", "📺 ESPN wants to replay that loss for educational purposes.", "🐌 Reaction time slower than Windows update.", "🚑 Call an ambulance, but not for the winner.", "🥇 Congratulations, you won… at losing.", "💸 Lost so hard the economy felt it.", "🌪️ Bro spun around so much, thought it was a Beyblade match.", "🫥 Disappeared from the leaderboard faster than my motivation.", "🐔 Gameplay so scared, KFC is calling.", "💣 That wasn’t a loss, that was a controlled demolition.", "🪑 Sit down, rethink your life choices.", "🧱 Built like a lag spike, moved like one too.", "🎤 Dropped the mic, but not a single kill.", "👀 Bro’s crosshair had social anxiety.", "🔋 Needed batteries before the fight.", "💭 Dreaming about winning doesn’t count, bro.", "📉 From hero to zero in record time.", "🥹 Even bots in tutorial mode perform better.", "🪩 The only thing shining today is your defeat.", "🧃 Grab some juice, you’re dehydrated from all that losing.", "💅 Took the ‘L’ with elegance, at least.", "💤 Sleepwalking gameplay detected.", "🕳️ Fell off so hard, even gravity clapped.", "🚪 DoorDash called — they want their delivery speed back.", "😵‍💫 Your strategy was like your Wi-Fi: nonexistent.", "🎭 Bro’s K/D ratio is now a comedy show.", "🐠 Flopping harder than a Magikarp.", "🧨 That match was a fireworks show — and you were the target.", "🪞 Look in the mirror, apologize to yourself for that performance.", "🥀 Legends say he’s still looking for his aim.", "🪙 Heads: you lose. Tails: you still lose.", "📸 Screenshot this — historical L moment.", "🍗 That match was finger-lickin’ embarrassing.", "🎻 Playing sad violin music in the background.", "🤦 Bro made history — for the wrong reasons.", "💔 Lost so bad, your controller filed for divorce.", "🧩 Skill issue wasn’t even the whole puzzle — it was the box cover.", "🚫 Even the matchmaker felt sorry.", "🎃 That loss was scarier than Halloween.", "🦘 Bounced out of the leaderboard like a kangaroo.", "🪦 RIP your ELO, gone but not forgotten.", "🧹 Swept off the floor, literally and emotionally.", "💀 A for effort, F for result.", "🐍 Slithering away from accountability, I see.", "💨 Got smoked, roasted, toasted, and ghosted.", "🦴 That performance had more bones than skill.", "🩻 Transparent gameplay detected.", "📚 Reading the tutorial won’t hurt, trust me.", "🧊 Ice cold under pressure… but in the bad way.", "🪤 Stepped right into the winner’s trap card.", "🎢 The only uptrend is your loss streak.", "🚽 That gameplay belonged in the toilet.", "💥 Exploded faster than your ELO could update.", "🧃 Take a sip of coping juice, champ.", "📅 Marked today as National Losing Day.", "🧩 Missing: skill, awareness, hope.", "😮‍💨 Lost that match AND your dignity.", "🕯️ A moment of silence for your rank.", "🏚️ Homeless ELO — nowhere to go.", "🌈 No pot of gold at the end of this L.", "🧃 Copium reserves running low!", "🍞 That performance was bread — dry and plain.", "🧱 Bro built a wall of excuses after that one.", "🐢 Movement so slow, you need time-lapse replay.", "🎯 Accuracy so low, you hit moral rock bottom instead.", ];

      const selectedTaunts = Array.from(
        { length: 3 },
        () => taunts[Math.floor(Math.random() * taunts.length)]
      ).join('\n');

      const adminMention = `<@${adminUserId}>`;

      await channel.send(
        `⚠️ **Dispute detected!**\n\n${selectedTaunts}\n\n🆚 Between: **${winner}** and **${loserUser}**\n👑 ${adminMention}, please review this mess.`
      );
    }
  });

  collector.on('end', async () => {
    if (!responded) {
      await channel.send(
        `⌛ ${loserUser} did not respond within 4 days. Match marked as **timeout**.`
      );
    }
  });
});

// --- Helpers ---
function getTierByElo(elo) {
  const tier =
    tiersData.tiers.find((tier) => elo >= tier.minElo && elo <= tier.maxElo) ||
    tiersData.tiers[tiersData.tiers.length - 1]; // fallback lowest tier
  return tier;
}

function getTierIndex(roleId) {
  return tiersData.tiers.findIndex((t) => t.roleId === roleId);
}

async function updatePlayerTier(message, user, newElo, oldTier) {
  const guild = message.guild;
  const member = await guild.members.fetch(user.id);
  const newTier = getTierByElo(newElo);
  if (!newTier) return '';

  const tierRoleIds = tiersData.tiers.map((t) => t.roleId);
  await member.roles.remove(tierRoleIds).catch(() => {});

  const newRole = guild.roles.cache.get(newTier.roleId);
  if (newRole) await member.roles.add(newRole).catch(() => {});

  if (!oldTier || !newTier) return '';
  if (oldTier.roleId !== newTier.roleId) {
    const newRoleName = guild.roles.cache.get(newTier.roleId)?.name || 'Unknown Role';
    if (newTier.minElo > oldTier.minElo) {
      return `📈 **Promoted to ${newRoleName}!**`;
    } else if (newTier.minElo < oldTier.minElo) {
      return `📉 **Demoted to ${newRoleName}.**`;
    }
  }

  return '';
}


eventHandler(client);

client.login(process.env.TOKEN);
