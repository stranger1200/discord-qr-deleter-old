//local vs hosted switch
if (!process.env.hasOwnProperty("TOKEN")) {
    process.env = require("./env.json");
}

const { Client, GatewayIntentBits, PermissionsBitField, Partials, EmbedBuilder } = require('discord.js');
const Scanner = require('./scanner.js');

//configure Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('for QR Codes | tag me!', { type: 'WATCHING' });
});

client.on('messageCreate', async function (msg) {
    //don't scan dms or self messages
    if (msg.channel.type === "DM" || msg.author.id === client.user.id) {
        return;
    }

    //if tagged, present about info
    //this does not stop the message from being scanned
    if (msg.content.includes(client.user.id)) {
        let uptimestr;
        {
            let diff = client.uptime;
            let s = Math.floor(diff / 1000);
            let m = Math.floor(s / 60);
            s = s % 60;
            let h = Math.floor(m / 60);
            m = m % 60;
            let d = Math.floor(h / 24);
            h = h % 24;
            uptimestr = `${d} days ${h} hours ${m} minutes ${s} seconds`;
        }

        // Determine whether to use "server" or "servers"
        const serverCount = client.guilds.cache.size;
        const serverText = serverCount === 1 ? "server" : "servers";

        const embed = new EmbedBuilder()
            .setTitle(`About ${client.user.username}`)
            .setAuthor({ name: `${client.user.username}`, iconURL: client.user.avatarURL() })
            .setColor(msg.member.displayHexColor)
            .setDescription("I find QR codes in messages and delete them! You must give me the __Manage Messages__ permission so that I can do my job most effectively.")
            .setThumbnail(client.user.avatarURL())
            .setTimestamp()
            .addFields({ name: "Statistics", value: `Uptime ${uptimestr}\nProtecting ${serverCount} ${serverText}\nPing: ${client.ws.ping}ms` });

        const sentMessage = await msg.channel.send({ embeds: [embed] });

        // Set a timeout to delete the message after 20 seconds
        setTimeout(() => {
            sentMessage.delete().catch(() => { });
        }, 20000); // 20000 milliseconds = 20 seconds
    }

    // Check if msg.member exists and has MANAGE_MESSAGES permission
    if (msg.member && msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return;
    }

    let deleted = await processMessage(msg);
    //if not deleted, observe it for reactions to allow users
    //to have a message manually scanned
    if (!deleted) {
        msg.awaitReactions({ max: 1, time: 300000, errors: [] }).then(async function (collected) {
            let deleted = await processMessage(msg);
            //if message is clean
            if (!deleted && (msg.attachments.size > 0 || msg.embeds.length > 0)) {
                msg.react("✅").catch(() => { });
            }
        });
    }
});

async function processMessage(msg) {
    let removed = false;
    if (msg.attachments.size > 0) {
        removed = await processAttachments(msg);
        return true;
    }
    if (!removed && msg.embeds.length > 0) {
        return await processEmbeds(msg);
    }
}

/**
 * Process a message's attachments and delete the message if it contains QR codes
 * @param {Discord.Message} msg the message object to check
 */
async function processAttachments(msg) {
    for (let attachment of msg.attachments.values()) {
        let res = await Scanner.scanURL(attachment.url);
        if (res) {
            const sentMessage = await msg.channel.send(deleteMsg(msg));
            setTimeout(() => {
                sentMessage.delete().catch(() => { });
            }, 10000); // 10000 milliseconds = 10 seconds
            console.log(`Deleted a QR code from user: ${msg.author.tag} (ID: ${msg.author.id})`);
            return true;
        }
    }
}

/**
 * Process a message's embeds and delete the message if it contains QR codes
 * @param {Discord.Message} msg the message object to check
 */
async function processEmbeds(msg) {
    for (let embed of msg.embeds) {
        let res = await Scanner.scanURL(embed.url);
        if (res) {
            const sentMessage = await msg.channel.send(deleteMsg(msg));
            setTimeout(() => {
                sentMessage.delete().catch(() => { });
            }, 10000); // 10000 milliseconds = 10 seconds
            console.log(`Deleted a QR code from user: ${msg.author.tag} (ID: ${msg.author.id})`);
            return true;
        }
    }
}

/**
 * Deletes an offending message and sends a message stating that it worked
 * @param {Discord.Message} message 
 */
function deleteMsg(message) {
    //play a mad-libs game to assemble the response
    const verbs = ["sneak", "pass", "smuggle", "throw", "drive", "slip"];
    const adjectives = ["fastest", "quickest", "most skillful", "acclaimed"];
    const adjectives2 = ["type", "stuff", "garbage"];
    const places = ["land", "world", "country", "sea", "server", "internet"];
    const verbs2 = ["spott", "destroy", "snip", "sniff", "roast", "eat"];
    const greetings = ["Hey", "Oy", "Whoa", "Stop"];
    const affirmations = ["like", "enjoy", "allow", "take", "upvote", "accept"];
    const directions = ["past", "through", "under"];

    const responses = [
        `${rand(greetings)} <@${message.author.id}>! That's a QR Code! We don't ${rand(affirmations)} that ${rand(adjectives2)} around here!`,
        `<@${message.author.id}> thought they could ${rand(verbs)} QR codes ${rand(directions)} me, but no dice.`,
        `<@${message.author.id}>, I'm the ${rand(adjectives)} QR code ${rand(verbs2)}er in the ${rand(places)}, and I just ${rand(verbs2)}ed yours.`,
    ];
    message.delete().catch(() => { message.channel.send("(Hey mods! I need perms to delete that!)").catch(() => { }) });
    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * @returns Returns a random element in an array
 * @param {[]} array array to use
 */
function rand(array) {
    return array[Math.floor(Math.random() * array.length)];
}

client.login(process.env.TOKEN);