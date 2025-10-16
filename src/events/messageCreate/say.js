const { Client, Message } = require("discord.js");

/**
 * @param {Client} client
 * @param {Message} message
 */
module.exports = async (client, message) => {
  try {
    if (!message.content.startsWith("!say")) return; // Only respond to !say commands

    // Extract the message after !say
    const text = message.content.slice("!say".length).trim();
    if (!text)
      return await message.reply("You need to provide a message to say!");

    await message.delete();

    await message.channel.send(text);
  } catch (err) {
    console.error(err);
  }
};
