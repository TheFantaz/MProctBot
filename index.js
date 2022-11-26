//Get Plugins
const mineflayer = require("mineflayer")
const {pathfinder, Movements, goals} = require("mineflayer-pathfinder")
const GoalFollow = goals.GoalFollow
const armorManager = require("mineflayer-armor-manager")
const autoeat = require("mineflayer-auto-eat")
const pvp = require('mineflayer-pvp').plugin

//This shows where the bot is going to join
const bot = mineflayer.createBot({
    host: "localhost",
    port: 50745,
    username: "Bodyguard"
})

//Load Plugins
bot.loadPlugin(pathfinder)
bot.loadPlugin(armorManager)
bot.loadPlugin(autoeat)
bot.loadPlugin(pvp)

//Initilizing Variables
const bossName = "The_Fantaz"
var mcData = null
var defaultMovementOption = null
var guardMode = 'guard'
const agressiveDistance = 16
const guardDistance = 4
var followingBoss = false // Used so the bot doesn't make a new pathfind every second 
var isDead = false
const distanceFromPlayer = 2
var DELAY = 0 //Delay is used so functions run once a second (less laggy, time to load)
const ignoreList = new Set(['Zombified Piglin'])
const optionalIgnoreList = new Set(['Iron Golem','Snow Golem','Villager'])
var doOptionalList = true;
//Loops through the inv and drops every item
function dropItems(){
    if (bot.inventory.items().length === 0) return
    const item = bot.inventory.items()[0]
    bot.tossStack(item)
    //Time out (of 1 Minecraft Tick) needed to allow bot data to update
    setTimeout(() =>dropItems(),150)
}

function followBoss(){
    
    if(isDead) return

    let boss = bot.players[bossName].entity
    //TP if boss is far away
    if(!boss){
        bot.chat("/tp " + bossName)
        DELAY = -20;
        followingBoss = false
        return
    }

    if(followingBoss) return
    //Follows the Boss now
    bot.pathfinder.setMovements(defaultMovementOption)
    bot.pathfinder.setGoal(new GoalFollow(boss, distanceFromPlayer),true)
    followingBoss = true
}

function optionalIgnoreListManager(mobType){
    if(optionalIgnoreList.has(mobType) && doOptionalList) return false;
    return true
}

function getNewTarget(isAttacker){

    //Manages delay between functions
    DELAY++
    if(DELAY !== 20) return
    else DELAY = 0

    //if(bot.pathfinder.isMining()) return

    if(guardMode === 'passive') followBoss()
    if(bot.pvp.target) return

    //Only attack close mobs
    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
            !ignoreList.has(e.mobType) && (e.kind === "Passive mobs" || e.kind === "Hostile mobs") && e.kind !== "Drops" 
            && optionalIgnoreListManager(e.mobType)
            

    const nearestEntity = bot.nearestEntity(filter)

    if(!nearestEntity){
        followBoss() //No enemies
        return
    }

    //Checks if the bot should attack the mob
    const mobDistance = bot.entity.position.distanceTo(nearestEntity.position)
    if(guardMode=== 'protect' && isAttacker || (mobDistance <= agressiveDistance && guardMode === 'agressive') || (mobDistance <= guardDistance && guardMode === 'guard'))
        changeTarget(nearestEntity)
    else followBoss()  
}

function changeTarget(newTarget){

    if(bot.pvp.target) return //Currently fighting an enemy

    if(!newTarget || guardMode === 'passive'){ // There are no enemies to fight, follow boss
        followBoss()
        return
    }

    equipSword()
    bot.pvp.attack(newTarget)
    followingBoss = false 
}
// :D
function findDiamonds(){
    console.log("I see this")
    const diamondOre = bot.findBlock({
        matching: mcData.blocksByName.deepslate_diamond_ore.id
    })
    if(diamondOre)
        bot.chat("/msg " + bossName + " " + diamondOre.position.x + " "+ diamondOre.position.y + " " + diamondOre.position.z)

    else
        bot.chat("/msg " + bossName + " Cannot find diamond ore")
}

function chatFunctions(username, message){
    if(username != bossName) return
    const expr = message.split(' ')[0]
    switch (expr) {
        case 'mode':
            if(message.split(' ')[1].match(/^(protect|passive|shoot|aggressive|guard)$/))
                guardMode = message.split(' ')[1]
                bot.chat("Mode: " + message.split(' ')[1])
            return
        case 'drop':
            dropItems()
            return
        case 'diamonds?':
            findDiamonds()
            return
        case 'hostile':
            doOptionalList = !doOptionalList
            if(doOptionalList) bot.chat("Doesn't attack good mobs")
            else bot.chat("Attacks good mobs")

    }        
}

function equipSword(){

    if(bot.heldItem){
        if(bot.heldItem.displayName.split(' ').length > 1){
            if(bot.heldItem.displayName.split(' ')[1] === 'Sword'){
                return // preventing equpping an already equipeed item (it causes it to crash)
            }
        }
    }
    setTimeout(() => {
        const sword = bot.inventory.items().find(item => item.name.includes('sword'))
        if(typeof sword == 'Array') sword = sword[0] //Incase multiple swords
        if (sword) bot.equip(sword, 'hand')
      }, 250) //Delay to give Bot time
}


bot.once("spawn", () => {
    bot.autoEat.options.eatingTimeout = 0
    mcData = require("minecraft-data")(bot.version)
    defaultMovementOption = new Movements(bot,mcData)
    bot.chat("Go to https://github.com/TheFantaz/MProctBot to see chat commands and source code")

    //Only physicTick needs to be  here (so it has time to get the player entity), but putting the rest here doesn't change anything
    console.log("Activating Listerners")
    bot.on('chat',chatFunctions)
    bot.on('physicTick',getNewTarget)
    bot.on('respawn', () => {setTimeout(() => {followingBoss = false;isDead = false},1000)})
    bot.on('entityHurt', (entity)=>{
        if(entity.username === bossName) getNewTarget(true)
    })
    //bot.on("autoeat_stopped", equipSword)
    bot.on('death', () => {isDead=true});

 
})