const WebSocket = require('ws');
const buffers = require('./config/buffers');
const algorithm = require("./utils/algorithm");
const Reader = require("./utils/reader");;
const ProxyManager = require('./config/proxyManager');
const config = require('./config/config');

let bots = [];
let maxBots = 10;
let wsServer = null;
let currentClient = null;
let initInterval = null;

let botHealthCheckInterval = null;
const BOT_HEALTH_CHECK_INTERVAL = 3650;


const data = {
    x: 0,
    y: 0,
    serverIP: null,
    protocolVersion: 0,
    clientVersion: 0,
    followMouse: true,
    party: ".",
    vshield: false
};

function showStartBanner() {
    const reset = '\x1b[0m';
    const blue = '\x1b[34m';
    const lightBlue = '\x1b[36m'; // Azul claro (cyan)
    const yellow = '\x1b[33m';
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const magenta = '\x1b[35m';
    const bold = '\x1b[1m';

    console.clear();

    const asciiArt = `
${blue}░ ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░ ░▒▓██████▓▒░▒▓████████▓▒░▒▓███████▓▒░ 
 ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░  ░▒▓█▓▒░        
 ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░  ░▒▓█▓▒░        
 ░▒▓████████▓▒░░▒▓█▓▒▒▓█▓▒░░▒▓███████▓▒░░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓██████▓▒░  
 ░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▓█▓▒░ ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░         ░▒▓█▓▒░ 
 ░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▓█▓▒░ ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░         ░▒▓█▓▒░ 
 ░▒▓█▓▒░░▒▓█▓▒░  ░▒▓██▓▒░  ░▒▓███████▓▒░ ░▒▓██████▓▒░  ░▒▓█▓▒░  ░▒▓███████▓▒░     ${reset}`;

    console.log(asciiArt);
    console.log(`${yellow}${bold}AvBots${reset} - ${magenta}${bold}FreeBots Agar.io 2025${reset}`);
    console.log(`${green}Developed By: ${bold}Null${reset}`);
    console.log('');

    let proxyStatus;
    if (!config.useProxies) {
        proxyStatus = `${red}✘ Disabled${reset}`.padEnd(10);
    } else if (config.useProxiesPlusIp) {
        proxyStatus = `${green}✔ Hybrid${reset}`.padEnd(10);
    } else {
        proxyStatus = `${green}✔ Enabled${reset}`.padEnd(10);
    }
    
    const scrapingStatus = config.useProxyScrape ? `${green}✔ Enabled${reset}`.padEnd(10) : `${red}✘ Disabled${reset}`.padEnd(10);
    const port = config.port.toString().padEnd(10);
    const version = "1.2".padEnd(10);

    console.log(`${lightBlue}Proxies:   ${reset}${proxyStatus}`);
    console.log(`${lightBlue}Scraping:  ${reset}${scrapingStatus}`);

    if (config.useProxyScrape) {
        console.log(`${lightBlue}Proxy Protocol: ${reset}${config.proxyProtocol.padEnd(30)}`);
        console.log(`${lightBlue}Proxy Timeout:  ${reset}${config.proxyTimeout.toString().padEnd(30)}`);
    }

    console.log(`${lightBlue}Port:      ${reset}${blue}${port}${reset}`);
    console.log(`${lightBlue}Discord:   ${reset}${blue}https://bit.ly/AvBots${reset}`);
    console.log(`${lightBlue}Version:   ${reset}${bold}${version}${reset}`);
}

function parseIP(url) {
    try {
        if (!url) throw new Error("URL is undefined");
        const parsedUrl = new URL(url);
        return parsedUrl.hostname + parsedUrl.pathname.replace(/\/$/g, '');
    } catch (error) {
        console.error("Error parsing IP:", error);
        return null; // Return null instead of throwing an error
    }
}

class Entity {
    constructor() {
        this.id = 0;
        this.x = 0;
        this.y = 0;
        this.size = 0;
        this.party = '';
        this.skin = '';
        this.isVirus = false;
        this.isPellet = false;
        this.isFriend = false;
    }
}

class Bot {
    constructor(gameIP, id) {
        this.id = id;
        this.party = data.party;
        this.gameIP = gameIP;
                // Add a check to handle undefined or invalid gameIP
                if (!gameIP) {
                    console.error("Game IP is undefined. Cannot create bot.");
                    return null;
                }
                
                try {
                    this.parsedGameIp = parseIP(this.gameIP);
                    if (!this.parsedGameIp) {
                        console.error("Failed to parse game IP:", gameIP);
                        return null;
                    }
                } catch (error) {
                    console.error("Error in Bot constructor:", error);
                    return null;
                }
        this.parsedGameIp = parseIP(this.gameIP);
        this.encryptionKey = 0;
        this.decryptionKey = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.gotMapSize = false;
        this.mapWidth = 0;
        this.mapHeight = 0;
        this.isAlive = false;
        this.lastActiveTime = Date.now();
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.botMoveInterval = null;
        this.botCellsIDs = [];
        this.viewportEntities = {};
        this.ghostCells = [];
        this.ws = null;
        this.biggerPlayerAvoidanceRange = 1.15; 
        this.avoidanceDistance = 1; 
        this.avoidanceDistance2 = 1; 
        this.proxyManager = proxyManager;
        this.currentProxy = null;
        this.connect();
    }

    connect() {
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
            this.replace();
            return;
        }
    
        this.connectionAttempts++;
        
        // Pass the bot ID to getNextProxy to determine if we should use a proxy or direct connection
        this.currentProxy = config.useProxies ? this.proxyManager.getNextProxy(this.id) : null;
        const wsOptions = this.proxyManager.configureWebSocketOptions(this.currentProxy);
    
        try {
            this.ws = new WebSocket(data.serverIP, wsOptions);
            this.ws.binaryType = "arraybuffer";
            this.ws.onopen = this.onopen.bind(this);
            this.ws.onmessage = this.onmessage.bind(this);
            this.ws.onclose = this.onclose.bind(this);
            this.ws.onerror = this.onerror.bind(this);
        } catch (error) {
        }
    }

    replace() {
        this.disconnect();
        const index = bots.indexOf(this);
        if (index !== -1) {
            const newBot = new Bot(data.serverIP, this.id);
            bots[index] = newBot;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.botMoveInterval) {
            clearInterval(this.botMoveInterval);
        }
        this.isAlive = false;
    }

    updateActivity() {
        this.lastActiveTime = Date.now();
    }

    isHealthy() {
        const inactiveTime = Date.now() - this.lastActiveTime;
        return this.ws && 
               this.ws.readyState === WebSocket.OPEN && 
               inactiveTime < 23000;
    }

    onopen() {
        this.updateActivity();
        this.send(buffers.protocol(data.protocolVersion));
        this.send(buffers.client(data.clientVersion));
    }


    onmessage(event) {
        this.updateActivity();
        try {
            if (this.decryptionKey) {
                let reader = new Reader(algorithm.rotateBufferBytes(event.data, this.decryptionKey ^ data.clientVersion), true);
                switch (reader.readUint8()) {
                    case 18:
                        setTimeout(() => this.ws.close(), 1000);
                        break;
                    case 32:
                        this.botCellsIDs.push(reader.readUint32());
                        if (!this.isAlive) {
                            this.isAlive = true;
                            this.botMoveInterval = setInterval(() => this.move(), 20);
                        }
                        break;
                    case 69:
                        const cellLength = reader.readUint16(true);
                        this.ghostCells = [];

                        for (let i = 0; i < cellLength; i++) {
                            const x = reader.readInt32(true);
                            const y = reader.readInt32(true);
                            const mass = reader.readUint32(true);
                            const size = Math.sqrt(mass) * 10;

                            if (Math.abs(x) < 14142 && Math.abs(y) < 14142 && mass > 0) {
                                this.ghostCells.push({ x, y, size, mass });
                            }
                        }
                       break;
                    case 85:
                        setTimeout(() => {
                            this.replace();
                            setTimeout(() => {
                                bots = bots.filter(bot => bot !== this);
                                bots.push(new Bot(data.serverIP, bots.length + 1));
                            }, 700);
                        }, 1000);
                        break;
                    case 242:
                        this.send(buffers.spawn(this.party));
                        break;
                    case 255:
                        const buffer = algorithm.uncompressBuffer(new Uint8Array(reader.dataView.buffer.slice(5)), new Uint8Array(reader.readUint32()));
                        reader = new Reader(buffer.buffer, true);
                        switch (reader.readUint8()) {
                            case 16:
                                const eatRecordLength = reader.readUint16();
                                reader.byteOffset += eatRecordLength * 8;

                                while (true) {
                                    const id = reader.readUint32();
                                    if (id === 0) break;
                                    const entity = new Entity();
                                    entity.id = id;
                                    entity.x = reader.readInt32();
                                    entity.y = reader.readInt32();
                                    entity.size = reader.readUint16();
                                    const flags = reader.readUint8();
                                    const extendedFlags = flags & 128 ? reader.readUint8() : 0;
                                    if (flags & 1) entity.isVirus = true;
                                    if (flags & 2) reader.byteOffset += 3;
                                    if (flags & 4) entity.skin = reader.readString();
                                    if (flags & 8) entity.name = reader.readString();
                                    if (extendedFlags & 1) entity.isPellet = true;
                                    if (extendedFlags & 2) entity.isFriend = true;
                                    if (extendedFlags & 4) reader.byteOffset += 4;
                                    this.viewportEntities[entity.id] = entity;
                                }

                                const removeRecordLength = reader.readUint16();
                                for (let i = 0; i < removeRecordLength; i++) {
                                    const removedEntityID = reader.readUint32();
                                    if (this.botCellsIDs.includes(removedEntityID)) {
                                        this.botCellsIDs.splice(this.botCellsIDs.indexOf(removedEntityID), 1);
                                    }
                                    delete this.viewportEntities[removedEntityID];
                                }

                                if (this.isAlive && this.botCellsIDs.length === 0) {
                                    this.isAlive = false;
                                    setTimeout(() => {
                                        this.party = data.party;
                                        this.send(buffers.spawn(this.party));
                                    }, 1500);
                                }
                                break;
                            case 64:
                                const left = reader.readFloat64();
                                const top = reader.readFloat64();
                                const right = reader.readFloat64();
                                const bottom = reader.readFloat64();
                                if (!this.gotMapSize) {
                                    this.gotMapSize = true;
                                    this.mapWidth = Math.floor(right - left);
                                    this.mapHeight = Math.floor(bottom - top);
                                }
                                if (Math.floor(right - left) === this.mapWidth && Math.floor(bottom - top) === this.mapHeight) {
                                    this.offsetX = (right + left) / 2;
                                    this.offsetY = (bottom + top) / 2;
                                }
                                break;
                        }
                        break;
                }
            } else {
                const reader = new Reader(event.data, true);
                if (reader.readUint8() === 0xf1) {
                    this.decryptionKey = reader.readUint32();
                    this.encryptionKey = algorithm.murmur2('' + this.parsedGameIp + reader.readString(), 255);
                }
            }
        } catch (error) {
            console.error(`\x1b[31m[Error] Bot ${this.id} error processing message: ${error}\x1b[0m`);
            this.replace();
        }
    }
    calculateDistanceWithPerimeter(x1, y1, size1, x2, y2, size2) {
        const centerDistance = Math.hypot(x2 - x1, y2 - y1);
        const distanceFromPerimeter = centerDistance - (size1 + size2);
        return Math.max(0, distanceFromPerimeter);
    }

    getClosestEntity(type, x, y, size) {
        let closestDistance = Infinity;
        let closestEntity = null;
        for (const entity of Object.values(this.viewportEntities)) {
            let isValid = false;
            switch (type) {
                case 'biggerPlayer':
                    isValid = !entity.isVirus && !entity.isPellet && !entity.isFriend &&
                              entity.size > size * this.biggerPlayerAvoidanceRange &&
                              entity.party !== this.party;
                    break;
                case 'smallerPlayer':
                    isValid = !entity.isVirus && !entity.isPellet && !entity.isFriend && 
                              entity.size < size && entity.name !== this.party;
                    break;
                case "pellet":
                    isValid = !entity.isVirus && !entity.isFriend && entity.isPellet;
                    break;
                case "virus":
                    isValid = entity.isVirus && !entity.isPellet && !entity.isFriend && 
                              size > entity.size * 1.32;
                    break;
                }
                if (isValid) {
                    const distance = this.calculateDistanceWithPerimeter(x, y, size, entity.x, entity.y, entity.size);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestEntity = entity;
                    }
                }
            }
            return {
                distance: closestDistance,
                entity: closestEntity
            };
        }
    sendPosition(x, y) {
        this.send(buffers.move(x, y, this.decryptionKey));
    }

    addGhostCell(x, y, size) {
        this.ghostCells.push({ x, y, size });
    }

    removeGhostCell(x, y) {
        const index = this.ghostCells.findIndex(cell => cell.x === x && cell.y === y);
        if (index !== -1) {
            this.ghostCells.splice(index, 1);
        }
    }

    isInGhostCell(x, y) {
        return this.ghostCells.some(cell => {
            const distance = Math.hypot(cell.x - x, cell.y - y);
            return distance < cell.size;
        });
    }

    move() {
        const bot = {
            x: 0,
            y: 0,
            size: 0
        };

        this.botCellsIDs.forEach(id => {
            const cell = this.viewportEntities[id];
            if (cell) {
                bot.x += cell.x / this.botCellsIDs.length;
                bot.y += cell.y / this.botCellsIDs.length;
                bot.size += cell.size;
            }
        });
        const closestBiggerPlayer = this.getClosestEntity('biggerPlayer', bot.x, bot.y, bot.size);
        const closestSmallerPlayer = this.getClosestEntity('smallerPlayer', bot.x, bot.y, bot.size);
        const closestPellet = this.getClosestEntity('pellet', bot.x, bot.y, bot.size);
        const closestVirus = this.getClosestEntity('virus', bot.x, bot.y, bot.size);
    
        const detectionRange = bot.size * 1.5;
        const detectionRange2 = bot.size * 1.2;
        
    if (data.vshield && bot.size >= 113 && closestVirus.entity) {
        this.send(buffers.move(closestVirus.entity.x, closestVirus.entity.y, this.decryptionKey));
        return;
    }
    
        if (data.followMouse) {
            if (closestBiggerPlayer.entity && closestBiggerPlayer.distance < this.avoidanceDistance + detectionRange) {
                const deltaX = bot.x - closestBiggerPlayer.entity.x;
                const deltaY = bot.y - closestBiggerPlayer.entity.y;
                const moveX = bot.x + deltaX;
                const moveY = bot.y + deltaY;
                this.send(buffers.move(moveX, moveY, this.decryptionKey));
            
            } else if (bot.size >= 80) {
                this.send(buffers.move(data.x + this.offsetX, data.y + this.offsetY, this.decryptionKey));
            } else if (closestVirus.entity && closestBiggerPlayer.entity) {
                this.ejectVirusTowardsPlayer(closestVirus.entity, closestBiggerPlayer.entity);
            } else {
                if (closestPellet.entity) {
                    this.send(buffers.move(closestPellet.entity.x, closestPellet.entity.y, this.decryptionKey));
                } else  {      const randomX = Math.floor(1337 * Math.random());
                const randomY = Math.floor(1337 * Math.random());
                this.send(buffers.move(bot.x + (Math.random() > 0.5 ? randomX : -randomX), bot.y + (Math.random() > 0.5 ? -randomY : randomY), this.decryptionKey));
            }
            }
        } else {
            if (this.botCellsIDs.length > 1) {
                if (closestPellet.entity) {
                    this.send(buffers.move(closestPellet.entity.x, closestPellet.entity.y, this.decryptionKey));
                } else  {     const randomX = Math.floor(1337 * Math.random());
                const randomY = Math.floor(1337 * Math.random());
                this.send(buffers.move(bot.x + (Math.random() > 0.5 ? randomX : -randomX), bot.y + (Math.random() > 0.5 ? -randomY : randomY), this.decryptionKey));
            }
            } else if (closestBiggerPlayer.entity && closestBiggerPlayer.distance < this.avoidanceDistance + detectionRange2) {
                const deltaX = bot.x - closestBiggerPlayer.entity.x;
                const deltaY = bot.y - closestBiggerPlayer.entity.y;
                const moveX = bot.x + deltaX;
                const moveY = bot.y + deltaY;
                this.send(buffers.move(moveX, moveY, this.decryptionKey));
            
            } else if (closestSmallerPlayer.entity && closestSmallerPlayer.entity.size <= bot.size * 0.83) {
                this.send(buffers.move(closestSmallerPlayer.entity.x, closestSmallerPlayer.entity.y, this.decryptionKey));
            } else if (closestPellet.entity) {
                this.send(buffers.move(closestPellet.entity.x, closestPellet.entity.y, this.decryptionKey));
            } else {
                const randomX = Math.floor(1337 * Math.random());
                const randomY = Math.floor(1337 * Math.random());
                this.send(buffers.move(bot.x + (Math.random() > 0.5 ? randomX : -randomX), bot.y + (Math.random() > 0.5 ? -randomY : randomY), this.decryptionKey));
            
            }
        }
    }
        setAvoidanceDistance(distance) {
        this.avoidanceDistance = distance;
    }
        setAvoidanceDistance2(distance) {
        this.avoidanceDistance2 = distance;
    }
        setBiggerPlayerAvoidanceRange(range) {
        this.biggerPlayerAvoidanceRange = range;
    }
    onerror(error) {
        this.replace();
    }

    onclose(event) {
        this.isAlive = false;
        this.replace();
    }

    eject() {
        const averageSize = this.botCellsIDs.reduce((totalSize, cellId) => {
            const entity = this.viewportEntities[cellId];
            return entity ? totalSize + entity.size : totalSize;
        }, 0);
    
        if (averageSize >= 80) {
            this.send(buffers.eject());
    }
}

    split() {
        const averageSize = this.botCellsIDs.reduce((totalSize, cellId) => {
            const entity = this.viewportEntities[cellId];
            return entity ? totalSize + entity.size : totalSize;
        }, 0);
    
        if (averageSize >= 80) {
            this.send(buffers.split());
        }
    }

    send(buffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (this.encryptionKey) {
                buffer = algorithm.rotateBufferBytes(buffer.buffer, this.encryptionKey);
                this.encryptionKey = algorithm.rotateEncryptionKey(this.encryptionKey);
            }
            this.ws.send(buffer);
        }
    }
}
function disconnectBotsSlowly(bots, callback) {
    if (bots.length === 0) {
        console.log('\x1b[33m[Info] No bots to disconnect\x1b[0m');
        if (callback) callback();
        return;
    }

    const totalBots = bots.length;
    let disconnectedCount = 0;

    function disconnectNext() {
        if (bots.length > 0) {
            const bot = bots.shift();
            if (bot) {
                try {
                    bot.disconnect();
                    disconnectedCount++;
                } catch (error) {
                    console.error(`\x1b[31m[Error] Error disconnecting bot ${bot.id}: ${error}\x1b[0m`);
                }
            }
            setTimeout(disconnectNext, 2);
        } else {
            console.log(`\x1b[32m[Success] All bots disconnected: ${disconnectedCount}/${totalBots}\x1b[0m`);
            if (callback) callback();
        }
    }
    disconnectNext();
}

function generateUUID(length = 8) { 
    let uuid = '';
    for (let i = 0; i < length; i++) {
        uuid += Math.floor(Math.random() * 10).toString();
    }
    return uuid;
}

function handleExit(signal) {
    clearInterval(connectBotsInterval);
    clearInterval(botCountInterval);
    disconnectBotsSlowly(bots, () => process.exit(0));
}
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m[Critical Error] Uncaught exception:', err, '\x1b[0m');
});
process.on('SIGINT', handleExit);
process.on("SIGTERM", handleExit);
process.on("beforeExit", handleExit);
process.on("exit", code => {
    console.log(`\x1b[35m[Exit] Process exiting with code ${code}: disconnecting bots...\x1b[0m`);
    clearInterval(connectBotsInterval);
    clearInterval(botCountInterval);
    disconnectBotsSlowly(bots);
});

const scriptKey = "key2";
const scriptVersion = 3;

function maintainBotCount() {
    const currentBotCount = bots.length;
    if (currentBotCount < maxBots) {
        const botsToAdd = maxBots - currentBotCount;
        for (let i = 0; i < botsToAdd; i++) {
            bots.push(new Bot(data.serverIP, currentBotCount + i + 1));
        }
    }
}

function checkBotsHealth() {
    bots.forEach((bot, index) => {
        if (!bot.isHealthy()) {
            bot.replace();
        }
    });
    maintainBotCount();
}
wsServer = new WebSocket.Server({ port: config.port });
showStartBanner();
const proxyManager = new ProxyManager();

wsServer.on('connection', (ws) => {
    if (currentClient) {
        console.log("\x1b[31m[Rejected] Connection attempt rejected: only one user allowed\x1b[0m");
        ws.send(JSON.stringify({ type: "error", message: "Only one user is allowed to connect at a time." }));
        ws.close();
        return;
    }
    let userId = generateUUID();
    let users = [];
    users.push(userId);

    currentClient = ws;
    console.log("\x1b[32m[Connection] User connected \x1b[0m" + userId);

    let botCountInterval = null;

    ws.on('close', () => {
        console.log("\x1b[31m[Disconnection] User disconnected\x1b[0m");
        currentClient = null;
        if (botHealthCheckInterval) {
            clearInterval(botHealthCheckInterval);
        }
        if (botCountInterval) {
            clearInterval(botCountInterval);
        }
        if (initInterval) {
            clearInterval(initInterval);
        }
        bots.forEach(bot => bot.disconnect());
        bots = [];
    });

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            switch (msg.type) {
                case 'start':
                    if (msg.config.scriptKey !== scriptKey || msg.config.scriptVersion !== scriptVersion) {
                        console.log("\x1b[31m[Auth Failed] Connection rejected: Invalid script key or version\x1b[0m");
                        ws.close();
                        return;
                    }

                    data.clientVersion = msg.config.clientVersion;
                    data.protocolVersion = msg.config.protocolVersion;
                    data.serverIP = msg.config.ip;
                    
                    console.log('\x1b[36m\x1b[0m');
                    console.log(`\x1b[36m\x1b[34mBots Mode:\x1b[37m ${config.useProxies ? 'Using Proxies' : 'Without Proxies'} ${' '.repeat(config.useProxies ? 23 : 21)}\x1b[36m \x1b[0m`);
                    console.log('\x1b[32m[Start] Starting bot connection...\x1b[0m');

                    let botIndex = 0;
                    initInterval = setInterval(() => {
                        if (botIndex < maxBots) {
                            bots.push(new Bot(data.serverIP, botIndex + 1, proxyManager));
                            botIndex++;
                            
                            if (botIndex % 10 === 0) {
                            }
                        } else {
                            clearInterval(initInterval);
                            botHealthCheckInterval = setInterval(checkBotsHealth, BOT_HEALTH_CHECK_INTERVAL);
                        }
                    }, 110);

                    if (botCountInterval) clearInterval(botCountInterval);
                    botCountInterval = setInterval(() => {
                        const connectedBots = bots.filter(bot => bot.isHealthy()).length;
                        const aliveBots = bots.filter(bot => bot.isHealthy() && bot.isAlive).length;
                        ws.send(JSON.stringify({ type: "botCount", connected: connectedBots, alive: aliveBots }));
                    }, 600);

                    break;

                    case 'stop':                        
                        if (initInterval) {
                            clearInterval(initInterval);
                            initInterval = null;
                        }
                        if (botCountInterval) {
                            clearInterval(botCountInterval);
                            botCountInterval = null;
                        }
                        if (botHealthCheckInterval) {
                            clearInterval(botHealthCheckInterval);
                            botHealthCheckInterval = null;
                        }
                        
                        const botsToDisconnect = [...bots];
                        bots = [];
                        
                        disconnectBotsSlowly(botsToDisconnect, () => {
                            data.followMouse = true;
                            data.vshield = false;
                            ws.send(JSON.stringify({ 
                                type: "stopped",
                                status: "success"
                            }));
                        });
                        break;
                case 'move':
                    data.x = msg.x;
                    data.y = msg.y;
                    break;

                case 'split':
                    bots.forEach(bot => bot.split());
                    break;

                case 'eject':
                    bots.forEach(bot => bot.eject());
                    break;

                case 'aiMode':
                    data.followMouse = !data.followMouse;
                    break;

                case 'updateBotName':
                    if (msg.botName) {
                        data.party = msg.botName;
                        bots.forEach(bot => {
                            bot.party = msg.botName;
                            bot.send(buffers.spawn(msg.botName));
                        });
                        ws.send(JSON.stringify({
                            type: "botNameUpdated",
                            success: true,
                            newBotName: msg.botName
                        }));
                    }
                    break;
                    case 'updateBotAmount':
                        const botAmount = parseInt(msg.botAmount, 10);
                        if (!isNaN(botAmount) && botAmount >= 1) {
                            maxBots = botAmount;
                            console.log(`\x1b[34m[✓] Updated bot count: ${maxBots}\x1b[0m`);
                    
                            if (bots.length > maxBots) {
                                const extraBots = bots.splice(maxBots);
                                console.log(`\x1b[33m[!] Disconnecting ${extraBots.length} extra bot(s)...\x1b[0m`);
                                extraBots.forEach(bot => {
                                    bot.disconnect();
                                });
                            }
                    
                            ws.send(JSON.stringify({
                                type: "botAmountUpdated",
                                success: true,
                                newBotCount: maxBots
                            }));
                        } else {
                            console.log(`\x1b[31m[X] Invalid bot amount received: ${msg.botAmount}. It must be a number greater than or equal to 1.\x1b[0m`);
                            ws.send(JSON.stringify({
                                type: "botAmountUpdated",
                                success: false,
                                error: "Invalid bot amount"
                            }));
                        }
                        break;
                        case 'vshield':
                            data.vshield = !data.vshield;
                            ws.send(JSON.stringify({
                                type: "vshieldUpdated",
                                enabled: data.vshield
                            }));
                            break;
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });
});