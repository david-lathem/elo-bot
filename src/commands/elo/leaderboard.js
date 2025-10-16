const { Client, Interaction } = require("discord.js");
const Player = require("../../models/Player");

module.exports = {
  name: "leaderboard",
  description: "View the top players ranked by ELO.",

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    // Fetch top players by ELO (highest first)
    const topPlayers = await Player.find().sort({ elo: -1 }).limit(10);

    if (!topPlayers.length) {
      return interaction.editReply("No players found in the leaderboard yet.");
    }

    // Create leaderboard table header
    let leaderboard = `\`\`\`\n🏆 ELO LEADERBOARD 🏆\n\n`;
    leaderboard += `#   USERNAME               ELO\n`;
    leaderboard += `──────────────────────────────────────\n`;

    // Format each player's row
    topPlayers.forEach((player, index) => {
      const rank = index + 1;
      const username = player.username.length > 18
        ? player.username.slice(0, 15) + "..."
        : player.username.padEnd(20, " ");
      const elo = player.elo.toString().padEnd(5, " ");

      leaderboard += `${rank.toString().padEnd(3, " ")} ${username} ${elo}\n`;
    });

    leaderboard += `\`\`\``;

    await interaction.editReply(leaderboard);
  },
};
