if (monkeyrunner && typeof monkeyrunner.cancel === "function"){
    monkeyrunner.cancel()}


// function dumper

// Object.getOwnPropertyNames(window)
//   .filter(x => x.toLowerCase().endsWith("ps"))
//   .join("\n")

// Number.parseFloat(Game.tech.getTechData('efficiencyResearch').getCostElement().text().replace(",",""))

var monkeyrunner = {
    timeoutID: null,
    cancel() {
        if (typeof this.timeoutID === "number") {
            clearInterval(this.timeoutID);
            this.timeoutID = null;
        }
    },
    setup(targetMonkey) {
        this.myMonkey = targetMonkey;
        if (typeof this.timeoutID === "number") {
              this.cancel();
            }
            this.myMonkey.setup();
            this.timeoutID = setInterval(
                () => this.myMonkey.run(this.myMonkey),
                1000,
            );
    }
}

var automonkey = {
    itemHeadroom: 100,
    powerWanted: 10000,

    message(text) {
        console.debug(`${new Date().toLocaleTimeString()} ${text}`);
        this.tabText(`${new Date().toLocaleTimeString()} ${text}`);
    },

    run() {
        this.tabText(`Running at ${new Date().toLocaleTimeString()} ...`);
        if (ring < 3 && dyson >=50) {
            buildRing();
        } else if (swarm <= 15 && dyson >= 100) {
            buildSwarm();
        } else if (dyson < 250) {
            // console.log("Dyson is below 250, getting more Dyson...");
            getDyson();
        } else {
            window.alert("250 Dyson!");
        }

        this.powerSupplythings(this);
        this.buildPower();

        this.buyScience();
        this.buildLabs(this);

        this.upgradeStorage(this);

        rebuildCommsWonder();
        rebuildStargate();
        rebuildRocketWonder();
        rebuildAntimatterWonder();
        activatePortal();

        this.noPowerThings().map(this.buildThing);
        if (energyps > this.powerWanted) {
            this.buildThings(this);
        }

        this.buildPlasma();

        this.tabText(`Sleeping at ${new Date().toLocaleTimeString()} ... Started at ${this.startDate.toLocaleTimeString()}`);
    },

    buyScience() {
        purchaseTech('unlockLabT4');
        purchaseTech('unlockLabT3');
        purchaseTech('unlockLabT2');
        purchaseTech('scienceEfficiencyResearch');
        // don't try and buy it if it's already at max level
        if (Game.tech.getTechData('energyEfficiencyResearch').current < Game.tech.getTechData('energyEfficiencyResearch').maxLevel){
            purchaseTech('energyEfficiencyResearch');
        }
    },

    buildThing(func) {
        if (eval(`${func}()`)) {
            this.message(`Built ${func}`);
        }
    },

    buildPlasma() {
        if (energyps > this.powerWanted) {
            getPlasmatic();
        }
    },

    buildPower() {
        this.buildThing("getFusionReactor");
        this.buildThing("getMagmatic");
        this.buildThing("getNuclearStation");
        this.buildThing("getMethaneStation");
        this.buildThing("getSolarPanel");
        this.buildThing("getCharcoalEngine");
        this.buildThing("getBatteryT5");
        this.buildThing("getBatteryT4");
        this.buildThing("getBatteryT3");
        this.buildThing("getBatteryT2");
        this.buildThing("getBattery");

    },

    buildLabs() {
        this.buildThing("getLabT5");
        this.buildThing("getLabT4");
        this.buildThing("getLabT3");
        this.buildThing("getLabT2");
        this.buildThing("getLab");
    },

    powerSupplythings(self) {
        const psHeadroom = Math.max(this.itemHeadroom, 0);
        if (lavaps < psHeadroom) {
            console.debug(`Need more lava, only have ${lavaps} < ${psHeadroom}`);
            getVeluptuator();
            getExtruder();
        }
        if (uraniumps < psHeadroom) {
            console.debug(`Need more uranium, only have ${uraniumps} < ${psHeadroom}`);
            getRecycler();
            getCubic();
            getGrinder();
        }
        if (methaneps < psHeadroom) {
            console.debug(`Need more methane, only have ${methaneps} < ${psHeadroom}`);
            self.buildMethane(self);
        }
        if (charcoalps < psHeadroom) {
            console.debug(`Need more charcoal, only have ${charcoalps} < ${psHeadroom}`);
            self.buildCharcoal(self);
        }

        if (hydrogenps < psHeadroom) {
            console.debug(`Need more hydrogen, only have ${hydrogenps} < ${psHeadroom}`);
            self.buildHydrogen(self);
        }
        if (heliumps < psHeadroom) {
            console.debug(`Need more helium, only have ${heliumps} < ${psHeadroom}`);
            self.buildHelium(self);
        }
    },

    /* Things that don't consume power */
    noPowerThings() {
        return [
            "getMiner", // metal
            "getWoodcutter", // Wood
            "getGemMiner", // gems
            "getBlowtorch", // silicon
            "getMoonWorker", // lunarite
            "getPump", // oil
            "getWoodburner", // charcoal
            "getVacuum", // methane
            "getExplorer", // titanium
            "getDroid", // gold
            "getScout", // silver
            "getCollector", // hydrogen
            "getDrone", // helium
            "getIcePick", // ice
        ]
    },

    buildMethane(self) {
        self.buildThing("getVent");
        self.buildThing("getSuctionExcavator");
        self.buildThing("getSpaceCow");
        self.buildThing("getVacuum");
    },

    buildHelium(self) {
        self.buildThing("getSkimmer");
        self.buildThing("getCompressor");
        self.buildThing("getTanker");
        self.buildThing("getDrone");
    },

    buildCharcoal(self) {
        self.buildThing("getFryer");
        self.buildThing("getKiln");
        self.buildThing("getFurnace");
        self.buildThing("getWoodburner");
    },

    buildHydrogen(self) {
        self.buildThing("getHindenburg");
        self.buildThing("getECell");
        self.buildThing("getMagnet");
        self.buildThing("getCollector");
    },

    buildThings(self) {
        // lunarite
        self.buildThing("getPlanetExcavator");
        self.buildThing("getMoonQuarry");
        self.buildThing("getMoonDrill");
        self.buildThing("getMoonWorker");

        // metal
        self.buildThing("getQuantumDrill");
        self.buildThing("getGigaDrill");
        self.buildThing("getHeavyDrill");
        self.buildThing("getMiner");

        // oil
        self.buildThing("getOilRig");
        self.buildThing("getOilField");
        self.buildThing("getPumpjack");
        self.buildThing("getPump");


        // titanium
        self.buildThing("getTitanDrill");
        self.buildThing("getPentaDrill");
        self.buildThing("getLunariteDrill");
        self.buildThing("getExplorer");

        // wood
        self.buildThing("getInfuser");
        self.buildThing("getDeforester");
        self.buildThing("getLaserCutter");
        self.buildThing("getWoodcutter");


        // ice
        self.buildThing("getMrFreeze");
        self.buildThing("getFreezer");
        self.buildThing("getIceDrill");
        self.buildThing("getIcePick");

        // gems
        self.buildThing("getCarbyneDrill");
        self.buildThing("getDiamondDrill");
        self.buildThing("getAdvancedDrill");
        self.buildThing("getGemMiner");

        // silver
        // self.buildThing("getCannon");
        // self.buildThing("getBertha");
        // self.buildThing("getSpaceLaser");
        self.buildThing("getScout");

        // gold
        // self.buildThing("getActuator");
        // self.buildThing("getDeathStar");
        // self.buildThing("getDestroyer");
        self.buildThing("getDroid");

        self.buildMethane(self);
        self.buildHelium(self);

        // silicon
        self.buildThing("getBlowtorch");

        // hydrogen
        self.buildThing("getCollector");

        self.buildHydrogen(self);

        // getAnnihilator();
        // getBath()
        // getCage()
        // getChemicalPlant();
        // getCloner();
        // getClub();

        // getCondensator();
        // getCrucible();

        // getDesert();
        // getDiamondChamber();
        // getExtractor();
        // getForest();
        // getFossilator();

        // getHarvester();
        // getHeater();
        // getHydrazine();
        // getInterCow();

        // getMaxEnergy();
        // getMaxPlasma();
        // getMicroPollutor();
        // getMultiDrill();
        // getNebulous();
        // getOverexchange();
        // getOxidisation();
        // getPhilosopher();
        // getPlanetNuke();
        // getPrinter();
        // getProduction();
        // getPSUT2();
        // getPSU();
        // getResource();
        // getResourceAfterTick();
        // getRocket();
        // getScorcher();
        // getSmasher();
        // getStorage();
        // getTardis();
        // getVeluptuator();
        // getWeb();
        // getWerewolf();
    },

    upgradeStorage(self) {
        upgradeLunariteStorage();
        upgradeWoodStorage();
        upgradeMetalStorage();
        upgradeTitaniumStorage();
        upgradeGemStorage();
        upgradeIceStorage();
        upgradeSiliconStorage();
        upgradeMethaneStorage();
        upgradeLavaStorage();
        upgradeUraniumStorage();
        upgradeHeliumStorage();
        upgradeCharcoalStorage();
        upgradeMeteoriteStorage();
        upgradeOilStorage();
        upgradeSilverStorage();
        upgradeHydrogenStorage();
        upgradeGoldStorage();
  },

  setup() {
    this.startDate = new Date();
    this.injectTab();
    this.tabText("Starting...");
  },

  tab: null,

  makeTab() {
    // const tabList = document.getElementById("tabList");
    this.tab = document.createElement("li");
    this.tab.id = "automonkeyTab";
    this.tab.className = "tab";
    this.tab.textContent = "Not Running";
    return this.tab;
  },

  injectTab() {
    const tabList = document.getElementById("tabList");
    if (tabList && !this.getTab()) {
      tabList.appendChild(this.makeTab());
    }
  },

  getTab() {
    const tabList = document.getElementById("tabList");
    return tabList.querySelector("#automonkeyTab");
  },

  tabText(text) {
    const tab = this.getTab();
    if (tab) {
      tab.textContent = text;
    }
  },

  removeTab() {
    const tab = this.getTab();
    if (tab) {
      tab.parentNode.removeChild(tab);
      this.tab = null;
    }
  }
};

console.debug(monkeyrunner.setup(automonkey));

