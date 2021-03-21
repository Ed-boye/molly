const Discord = require('discord.js');
const config = require('./config.json');
// const { Client, ReactionCollector } = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'REACTION', 'USER'] });

let roleConfig;
let guild;

client.once('ready', async () => {
    console.log('Ready, Let\'s Roll');

    // client.user.setActivity(`on ${client.guilds.size} servers`);

    if (config.env == 'dev') {
        roleConfig = require('./_dev.json');
    }
    else {
        roleConfig = require('./_prod.json');
    }

    guild = client.guilds.cache.first();
    // Only works if the bot is running on one guild

    // Populate role map
    for (const [messageId, map] of Object.entries(roleConfig.roleMessagesMaps)) {

        // Fetch the role channel from the server
        const channel = guild.channels.cache.find(chan => chan.id === roleConfig.roleChannelId);

        // Fetch the current message map we're iterating on
        const msg = await channel.messages.fetch(messageId);

        // Iterate through the current message's "emoji --> role" map, confirm the server is configured properly by
        // replacing the roles (TODO: and emoji) with the actual objects from the server, and add reactions to the correct messages.
        for (const [emoji, role] of Object.entries(map)) {

            // We'll use this later for assigning this Role Object to the user
            const discordRole = guild.roles.cache.find(roleObj => roleObj.name === role);

            // Set role if not undefined, otherwise throw an error
            // TODO: Sending error messages should go in a helper method
            roleConfig.roleMessagesMaps[messageId][emoji] = discordRole
                ? discordRole
                : guild.channels.cache.find(chan => chan.id === roleConfig.errorChannelId)
                    .send(`I tried to load this role that doesn't exist: ${role}`)
                    .catch((error) => {
                        console.error(`Couldn't send message in Discord about roles not being loaded. Error: "${error}"`);
                    });

            // TODO: Also fetch/check for Emoji so we catch if an emoji isn't on the server ahead of time

            // Add the emoji to the role message so folks don't have to hunt for the emoji
            // TODO: Sending error messages should go in a helper method
            msg.react(emoji)
                .catch((error) => {
                    console.error(`Unable to add the "${emoji}". Error: "${error}"`);
                    guild.channels.cache.find(chan => chan.id === roleConfig.errorChannelId)
                        .send(`I tried to react with an emoji not on the server: ${emoji}`)
                        .catch((error2) => {
                            console.error(`Couldn't send message in Discord about emoji not being added. Error: "${error2}"`);
                        });
                });
        }
    }

    // TODO: Create the roles if they don't exist?
});

client.on('messageReactionAdd', async (messageReaction, user) => {

    // Don't handle reaction if it's a bot reacting (i.e., this one)
    if (user.bot) return;

    // Don't handle reaction if it's not in the Role Channel
    if (messageReaction.message.channel.id != roleConfig.roleChannelId) return;

    const messageKey = messageReaction.message.id;
    const roles = roleConfig.roleMessagesMaps[messageKey];

    if (roles != undefined) {
        // This is a reaction on a message we care about

        if (messageReaction.partial) await messageReaction.fetch();
        // Ensure we've got a full Reaction object

        const emojiKey = messageReaction.emoji.id
            ? messageReaction.emoji.id
            : messageReaction.emoji.name;
        // Get the emoji ID if custom emoji or the emoji itself is it's a (standard) Unicode Emoji

        if (roles[emojiKey] != undefined) {
            // The reaction is associated to a role
            // Set the user's role
            guild.members.fetch(user.id)
                .then((guildMember) => {
                    guildMember.roles.add(roleConfig.roleMessagesMaps[messageKey][emojiKey]);
                });
            // TODO: Figure out if I need to check partial to avoid always fetching via API
            // TODO: This is the only difference between add/remove, use helper method
        }
    }
    else {
        // An add on a message we don't care about
        return;
    }
});

client.on('messageReactionRemove', async (messageReaction, user) => {
    // Is this reaction to something in the role channel?
    if (messageReaction.message.channel.id != roleConfig.roleChannelId) return;

    const messageKey = messageReaction.message.id;
    const roles = roleConfig.roleMessagesMaps[messageKey];

    if (roles != undefined) {
        // This is a reaction on a message we care about

        if (messageReaction.partial) await messageReaction.fetch();
        // Ensure we've got a full Reaction object

        const emojiKey = messageReaction.emoji.id
            ? messageReaction.emoji.id
            : messageReaction.emoji.name;
        // Get the emoji ID if custom emoji or the emoji itself is it's a (standard) Unicode Emoji

        if (roles[emojiKey] != undefined) {
            // The reaction is associated to a role
            // Remove the user's role
            guild.members.fetch(user.id)
                .then((guildMember) => {
                    guildMember.roles.remove(roleConfig.roleMessagesMaps[messageKey][emojiKey]);
                });
            // TODO: Figure out if I need to check partial to avoid always fetching via API
            // TODO: This is the only difference between add/remove, use helper method
        }
    }
    else {
        // A removal on a message we don't care about
        return;
    }
});

/*
client.on('messageReactionRemoveAll', async (message) => {
    // TODO: Not sure... any utility here?
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    // TODO: re-run the role load if it's a message. Gotta grab all the emoji
});
*/

client.login(config.token);