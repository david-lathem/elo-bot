const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const Player = require("../../models/Player");

// Load tier data from ranking.json
const tiersData = require("../../../rankings.json");

module.exports = {
  name: "profile",
  description: "View your or another player's 1v1 profile.",
  options: [
    {
      name: "user",
      description: "Mention a player to view their profile.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    await interaction.deferReply({ ephemeral: false });

    // Fetch or create player record
    let player =
      (await Player.findOne({ userId: targetUser.id })) ||
      new Player({
        userId: targetUser.id,
        username: targetUser.username,
      });

    await player.save();

    // Calculate stats
    const totalMatches = player.wins + player.losses;
    const winRate =
      totalMatches === 0
        ? "N/A"
        : ((player.wins / totalMatches) * 100).toFixed(1) + "%";

    const currentTier =
      getTierByElo(player.elo) || tiersData.tiers[tiersData.tiers.length - 1];
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUser.id);

    // Fetch actual role from guild
    const tierRole = guild.roles.cache.get(currentTier.roleId);
    const tierRoleName = tierRole ? tierRole.name : "Unranked";

    // Sync rank role
    try {
      const tierRoleIds = tiersData.tiers.map((t) => t.roleId);
      await member.roles.remove(tierRoleIds).catch(() => {});
      if (tierRole && !member.roles.cache.has(currentTier.roleId)) {
        await member.roles.add(tierRole).catch(() => {});
      }
    } catch (err) {
      console.error("Role sync failed:", err);
    }

    // 🎨 Build a beautiful embed
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${targetUser.username}'s 1v1 Profile`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true }),
      })
      .setColor("#00AEEF")
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
      .setDescription(
        `✨ **Competitive Profile Overview**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📈 **Tier:** \`${tierRoleName}\`\n` +
        `💠 **ELO:** \`${player.elo}\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 **Wins:** \`${player.wins}\`\n` +
        `💀 **Losses:** \`${player.losses}\`\n` +
        `📊 **Win Rate:** \`${winRate}\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setFooter({
        text: currentTier.description || "Keep grinding to reach the next tier!",
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

/**
 * Find tier based on ELO
 */
function getTierByElo(elo) {
  return tiersData.tiers.find(
    (tier) => elo >= tier.minElo && elo <= tier.maxElo
  );
}
