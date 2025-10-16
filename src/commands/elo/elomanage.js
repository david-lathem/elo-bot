const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const Player = require("../../models/Player");

// Load tier data

const tiersData = require("../../../rankings.json");

module.exports = {
  name: "elo",
  description: "Add or remove ELO from a player (Admin only).",
  options: [
    {
      name: "action",
      description: "Choose whether to add or remove ELO.",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "Add", value: "add" },
        { name: "Remove", value: "remove" },
      ],
    },
    {
      name: "player",
      description: "The player whose ELO you want to modify.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "amount",
      description: "The amount of ELO to modify.",
      type: ApplicationCommandOptionType.Integer,
      required: true,
    },
  ],

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const action = interaction.options.getString("action");
    const targetUser = interaction.options.getUser("player");
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0) {
      return interaction.reply({
        content: "⚠️ Please enter an ELO amount greater than 0.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: false });

    // Fetch or create player data
    let player = await Player.findOne({ userId: targetUser.id });
    if (!player) {
      player = new Player({
        userId: targetUser.id,
        username: targetUser.username,
      });
    }

    const oldElo = player.elo;
    let newElo = oldElo;

    if (action === "add") {
      newElo = oldElo + amount;
    } else if (action === "remove") {
      newElo = Math.max(0, oldElo - amount);
    }

    const oldTier = getTierByElo(oldElo);
    player.elo = newElo;
    await player.save();

    const tierChange = await updatePlayerTier(
      interaction,
      targetUser,
      newElo,
      oldTier
    );

    const emoji = action === "add" ? "📈" : "📉";
    const verb = action === "add" ? "added to" : "removed from";

    await interaction.editReply(
      `${emoji} **Admin Action:** ${
        interaction.user
      } ${verb} **${amount} ELO** ${
        action === "add" ? "to" : "from"
      } ${targetUser}.\n` +
        `🧾 ${targetUser}'s ELO: **${oldElo} → ${newElo}** ${tierChange}`
    );
  },
};

/**
 * Find tier by ELO value
 */
function getTierByElo(elo) {
  return tiersData.tiers.find(
    (tier) => elo >= tier.minElo && elo <= tier.maxElo
  );
}

/**
 * Handles rank updates and promotion/demotion
 */
async function updatePlayerTier(interaction, user, newElo, oldTier) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(user.id);
  const newTier = getTierByElo(newElo);
  if (!newTier) return "";

  // Remove all tier roles
  const tierRoleIds = tiersData.tiers.map((t) => t.roleId);
  await member.roles.remove(tierRoleIds).catch(() => {});

  // Add new tier role
  const newRole = guild.roles.cache.get(newTier.roleId);
  if (newRole) await member.roles.add(newRole).catch(() => {});

  // Compare tiers
  if (!oldTier || !newTier) return "";
  if (oldTier.roleId !== newTier.roleId) {
    if (newTier.minElo > oldTier.minElo) {
      return `🏅 **Promoted to ${
        guild.roles.cache.get(newTier.roleId)?.name || "New Tier"
      }!**`;
    } else if (newTier.minElo < oldTier.minElo) {
      return `📉 **Demoted to ${
        guild.roles.cache.get(newTier.roleId)?.name || "Lower Tier"
      }.**`;
    }
  }

  return "";
}
