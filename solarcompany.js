// Number.parseFloat(Game.tech.getTechData('efficiencyResearch').getCostElement().text().replace(",",""))

var monkeyrunner = {
    timeoutID: null,
    cancel() {
        if (typeof this.timeoutID === "number") {
            clearTimeout(this.timeoutID);
            this.timeoutID = null;
        }
    },
    setup(targetMonkey) {
        this.myMonkey = targetMonkey;
        if (typeof this.timeoutID === "number") {
              this.cancel();
            }
            this.myMonkey.setup();
            this.timeoutID = setTimeout(
                () => this.myMonkey.run(this.myMonkey),
                1000,
            );
    }
}

var automonkey = {
    min_headroom: 100,

    run() {
        this.tabText("Running...");
        if (dyson < 250) {
            // console.log("Dyson is below 250, getting more Dyson...");
            getDyson();
        } else {
            console.info("250 Dyson!");
        }

        this.buyScience();
        this.buildLabs(this);
        this.upgradeStorage(this);

        if (energyps > 10000) {
            this.buildThings(this);
        } else {
            this.buildPower(this);
        }
        this.tabText(`Sleeping... at ${new Date().toLocaleTimeString()}`);
        console.info(`Sleeping... at ${new Date().toLocaleTimeString()}`);
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


    buildPower(self) {
        if (getFusionReactor()) { console.log("getFusionReactor")};
        if (getMagmatic()) { console.log("getMagmatic")};
        if (getNuclearStation()) { console.log("getNuclearStation")};
        if (getMethaneStation()) { console.log("getMethaneStation")};
        if (getSolarPanel()) { console.log("getSolarPanel")};
        if (getCharcoalEngine()) { console.log("getCharcoalEngine")};
        if (getBatteryT5()) { console.log("getBatteryT5")};
        if (getBatteryT4()) { console.log("getBatteryT4")};
        if (getBatteryT3()) { console.log("getBatteryT3")};
        if (getBatteryT2()) { console.log("getBatteryT2")};
        if (getBattery()) { console.log("getBattery")};

    },

    buildLabs(self) {
        getLabT5();
        getLabT4();
        getLabT3();
        getLabT2();
        getLab();
    },
    // scienceps
    // silverps
    // uraniumps
    // iceps
    // woodps
    // plasmaps
    // energyps
    // metalps
    // goldps
    // meteoriteps
    // methaneps
    // siliconps
    // antimatterps
    // heliumps
    // oilps
    // rocketFuelps
    // lavaps
    // charcoalps
    // gemps
    // hydrogenps

    buildThings(self) {
        // lunarite
        if (lunariteps < self.min_headroom) {
            getPlanetExcavator();
            getMoonQuarry();
            getMoonDrill();
            getMoonWorker();
        }

        // titanium
        if (titaniumps < self.min_headroom) {
            getTitanDrill();
            getPentaDrill();
            getLunariteDrill();
            getExplorer();
        }

        // wood
        getInfuser();
        // getDeforester();
        // getWoodcutter();

        // charcoal
        getWoodburner();

        // getActuator();
        // getAdvancedDrill();
        // getAnnihilator();
        // getBath()
        // getBertha();
        // getBlowtorch();
        // getCage()
        // getCannon();
        // getCarbyneDrill();
        // getChemicalPlant();
        // getCloner();
        // getClub();
        // getCollector();
        // getCompressor();
        // getCondensator();
        // getCrucible();
        // getCubic();
        // getDeathStar();
        // getDesert();
        // getDestroyer();
        // getDiamondChamber();
        // getDiamondDrill();
        // getDroid();
        // getDrone();
        // getDyson();
        // getECell();
        // getEnricher();
        // getExtractor();
        // getExtruder();
        // getForest();
        // getFossilator();
        // getFreezer();
        // getFryer();
        // getFurnace();
        // getGemMiner();
        // getGigaDrill();
        // getGrinder();
        // getHarvester();
        // getHeater();
        // getHeavyDrill();
        // getHindenburg();
        // getHydrazine();
        // getIceDrill();
        // getIcePick();
        // getInterCow();
        // getKiln();
        // getLaserCutter();
        // getMagnet();
        // getMaxEnergy();
        // getMaxPlasma();
        // getMicroPollutor();
        // getMiner();
        // getMrFreeze();
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
        // getRecycler();
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