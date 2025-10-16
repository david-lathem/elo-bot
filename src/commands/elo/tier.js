const { Client, Interaction, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const tiersData = require("../../../rankings.json");

module.exports = {
  name: "tier",
  description: "View all current ELO tiers and their requirements.",

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });
    const guild = interaction.guild;

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle("🏆 Current ELO Tiers")
      .setColor("#FFD700")
      .setDescription("Here are all the ranks and their ELO ranges:")
      .setTimestamp();

    // Add fields for each tier
    for (const tier of tiersData.tiers) {
      const role = guild.roles.cache.get(tier.roleId);
      const roleName = role ? role.name : "(Role Missing)";

      embed.addFields({
        name: `🎖️ ${roleName}`,
        value: `**ELO Range:** ${tier.minElo}–${tier.maxElo}\n*${tier.description}*`,
        inline: false,
      });
    }

    embed.setFooter({
      text: "Tiers update automatically based on your ELO.",
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
