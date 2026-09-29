var automonkey = {
    min_headroom: 100,

  run(self) {
    self.tabText("Running...");
    if (dyson < 250) {
        // console.log("Dyson is below 250, getting more Dyson...");
        getDyson();
    } else {
        console.info("250 Dyson!");
    }
    self.buildLabs(self);
    self.upgradeStorage(self);
    if (energyps > 10000) {
        self.buildThings(self);
    } else {
        self.buildPower(self);
    }
    self.tabText("Sleeping...");
    console.info("Sleeping... at $(" + new Date().toLocaleTimeString() + ")");
},

buildPower(self) {

    getFusionReactor();
    getMagmatic();
    getNuclearStation();
    getMethaneStation();
    getSolarPanel();
    getCharcoalEngine();
    getBatteryT5();
    getBatteryT4();
    getBatteryT3();
    getBatteryT2();
    getBattery();

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
    if (typeof this.timeoutID === "number") {
      this.cancel();
    }
    this.timeoutID = setTimeout(
        () => this.run(this),
        1000,
    );
    this.tabText("Starting...");
  },

  cancel() {
    clearTimeout(this.timeoutID);
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


automonkey.setup();


// function dumper

// Object.getOwnPropertyNames(window)
//   .filter(x => x.toLowerCase().endsWith("ps"))
//   .join("\n")