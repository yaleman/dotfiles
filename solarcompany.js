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
        if (dyson < 250) {
            // console.log("Dyson is below 250, getting more Dyson...");
            getDyson();
        } else {
            window.alert("250 Dyson!");
        }

        this.powerSupplythings();
        this.buyScience();
        this.buildLabs(this);
        this.upgradeStorage(this);

        this.buildPower();
        rebuildCommsWonder();
        rebuildStargate();
        rebuildRocketWonder();
        rebuildAntimatterWonder();
        activatePortal();
        this.buildThings(this);

        this.tabText(`Sleeping at ${new Date().toLocaleTimeString()} ...`);
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

    powerSupplythings() {
        const psHeadroom = Math.max(this.itemHeadroom / 4, 0);
        if (lavaps < psHeadroom) {
            getVeluptuator();
            getExtruder();
        }
        if (uraniumps < psHeadroom) {
            getRecycler();
            getCubic();
            getGrinder();
        }
    },

    buildThings(self) {
        // lunarite
        self.buildThing("getPlanetExcavator");
        self.buildThing("getMoonQuarry");
        self.buildThing("getMoonDrill");
        self.buildThing("getMoonWorker");

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

        // getActuator();
        // getAnnihilator();
        // getBath()
        // getBertha();
        // getBlowtorch();
        // getCage()
        // getCannon();
        // getChemicalPlant();
        // getCloner();
        // getClub();
        // getCollector();
        // getCompressor();
        // getCondensator();
        // getCrucible();

        // getDeathStar();
        // getDesert();
        // getDestroyer();
        // getDiamondChamber();
        // getDroid();
        // getDrone();
        // getECell();
        // getExtractor();
        // getForest();
        // getFossilator();
        // getFryer();
        // getFurnace();
        // ();
        // getGigaDrill();

        // getHarvester();
        // getHeater();
        // getHeavyDrill();
        // getHindenburg();
        // getHydrazine();
        // getInterCow();
        // getKiln();
        // getMagnet();
        // getMaxEnergy();
        // getMaxPlasma();
        // getMicroPollutor();
        // getMiner();
        // getMultiDrill();
        // getNebulous();
        // getOilField();
        // getOilRig();
        // getOverexchange();
        // getOxidisation();
        // getPhilosopher();
        // getPlanetNuke();
        // getPlasmatic();
        // getPrinter();
        // getProduction();
        // getPSUT2();
        // getPSU();
        // getPump();
        // getPumpjack();
        // getQuantumDrill();
        // getResource();
        // getResourceAfterTick();
        // getRocket();
        // getScorcher();
        // getScout();
        // getSkimmer();
        // getSmasher();
        // getSpaceCow();
        // getSpaceLaser();
        // getStorage();
        // getSuctionExcavator();
        // getTanker();
        // getTardis();
        // getVacuum();
        // getVeluptuator();
        // getVent();
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

monkeyrunner.setup(automonkey);


// function dumper

// Object.getOwnPropertyNames(window)
//   .filter(x => x.toLowerCase().endsWith("ps"))
//   .join("\n")