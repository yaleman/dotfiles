// biome-ignore lint/correctness/noInvalidUseBeforeDeclaration: "used to reset state"
monkeyrunner?.cancel();

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
		this.timeoutID = setInterval(() => this.myMonkey.run(this.myMonkey), 1000);
	},
};

var automonkey = {
	itemHeadroom: 100,
	powerWanted: 10000,
	maxSwarms: 6,

	message(text) {
		console.debug(`${new Date().toLocaleTimeString()} ${text}`);
		this.tabText(`${new Date().toLocaleTimeString()} ${text}`);
	},

	maxedOut(item) {
		return Game.resources.getStorage(item) === window[item];
	},

	run() {
		this.tabText(`Running at ${new Date().toLocaleTimeString()} ...`);
		if (ring < 3 && dyson >= 50) {
			buildRing();
		} else if (swarm <= this.maxSwarms && dyson >= 100) {
			buildSwarm();
		} else if (dyson < 250) {
			// console.log("Dyson is below 250, getting more Dyson...");
			getDyson();
		} else {
			window.alert("250 Dyson!");
		}

		this.powerSupplythings();

		// don't need it if we have a huge glut of it
		if (energyps < 20000) {
			this.buildPower();
		}

		this.buyScience();
		this.buildLabs();

		this.upgradeStorage();

		rebuildCommsWonder();
		rebuildStargate();
		rebuildRocketWonder();
		rebuildAntimatterWonder();
		activatePortal();

		this.noPowerThings().map(this.buildThing);
		if (plasmaps >= 23.0 || Game.resources.getStorage("plasma") === plasma) {
			this.buildThing("getWeb");
		}
		if (energyps > this.powerWanted) {
			this.buildThings();
		}

		this.buildPlasma();

		this.tabText(
			`Sleeping at ${new Date().toLocaleTimeString()} ... Started at ${this.startDate.toLocaleTimeString()}`,
		);
	},

	buyScience() {
		purchaseTech("unlockLabT3");
		purchaseTech("unlockLabT2");
		if (
			Game.tech.entries.unlockLabT4.unlocked &&
			Game.tech.entries.unlockLabT4.current === 0 &&
			scienceps > 7500
		) {
			purchaseTech("unlockLabT4");
		} else {
			purchaseTech("scienceEfficiencyResearch");
			// don't try and buy it if it's already at max level
			if (
				Game.tech.getTechData("energyEfficiencyResearch").current <
				Game.tech.getTechData("energyEfficiencyResearch").maxLevel
			) {
				purchaseTech("energyEfficiencyResearch");
			}
		}
	},

	buildThing(func) {
		if (typeof func !== "string") {
			console.error(`Invalid function input: ${func}`);
			return;
		}
		try {
			if (window[func]()) {
				this.message(`Built ${func}`);
			}
		} catch (e) {
			console.error(`Failed to build ${func.toString()}: ${e}`);
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

	powerSupplythings() {
		const psHeadroom = Math.max(this.itemHeadroom, 0);
		if (lavaps < psHeadroom) {
			console.debug(`Need more lava, only have ${lavaps} < ${psHeadroom}`);
			getVeluptuator();
			getExtruder();
		}
		if (uraniumps < psHeadroom) {
			console.debug(
				`Need more uranium, only have ${uraniumps} < ${psHeadroom}`,
			);
			getRecycler();
			getCubic();
			getGrinder();
		}
		if (methaneps < psHeadroom) {
			console.debug(
				`Need more methane, only have ${methaneps} < ${psHeadroom}`,
			);
			this.buildMethane();
		}
		if (charcoalps < psHeadroom) {
			console.debug(
				`Need more charcoal, only have ${charcoalps} < ${psHeadroom}`,
			);
			this.buildCharcoal();
		}

		if (hydrogenps < psHeadroom) {
			console.debug(
				`Need more hydrogen, only have ${hydrogenps} < ${psHeadroom}`,
			);
			this.buildHydrogen();
		}
		if (heliumps < psHeadroom) {
			console.debug(`Need more helium, only have ${heliumps} < ${psHeadroom}`);
			this.buildHelium();
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
		];
	},

	buildMethane() {
		if (this.maxedOut("methane")) return;
		this.buildThing("getVent");
		this.buildThing("getSuctionExcavator");
		this.buildThing("getSpaceCow");
		this.buildThing("getVacuum");
	},

	buildHelium() {
		if (this.maxedOut("helium")) return;
		this.buildThing("getSkimmer");
		this.buildThing("getCompressor");
		this.buildThing("getTanker");
		this.buildThing("getDrone");
	},

	buildCharcoal() {
		if (this.maxedOut("charcoal")) return;
		this.buildThing("getFryer");
		this.buildThing("getKiln");
		this.buildThing("getFurnace");
		this.buildThing("getWoodburner");
	},

	buildHydrogen() {
		if (this.maxedOut("hydrogen")) return;
		this.buildThing("getHindenburg");
		this.buildThing("getECell");
		this.buildThing("getMagnet");
		this.buildThing("getCollector");
	},

	buildSilicon() {
		if (this.maxedOut("silicon")) return;
		this.buildThing("getBlowtorch");
		this.buildThing("getDesert");
		this.buildThing("getAnnihilator");
		this.buildThing("getScorcher");
	},

	buildThings() {
		// lunarite
		if (!this.maxedOut("lunarite")) {
			this.buildThing("getPlanetExcavator");
			this.buildThing("getMoonQuarry");
			this.buildThing("getMoonDrill");
			this.buildThing("getMoonWorker");
		}

		// metal
		if (!this.maxedOut("metal")) {
			this.buildThing("getQuantumDrill");
			this.buildThing("getGigaDrill");
			this.buildThing("getHeavyDrill");
			this.buildThing("getMiner");
		}

		// gems
		if (!this.maxedOut("gems")) {
			this.buildThing("getCarbyneDrill");
			this.buildThing("getDiamondDrill");
			this.buildThing("getAdvancedDrill");
			this.buildThing("getGemMiner");
		}

		// oil
		if (!this.maxedOut("oil")) {
			this.buildThing("getOilRig");
			this.buildThing("getOilField");
			this.buildThing("getPumpjack");
			this.buildThing("getPump");
		}

		// titanium
		if (!this.maxedOut("titanium")) {
			this.buildThing("getTitanDrill");
			this.buildThing("getPentaDrill");
			this.buildThing("getLunariteDrill");
			this.buildThing("getExplorer");
		}

		// wood
		if (!this.maxedOut("wood")) {
			this.buildThing("getInfuser");
			this.buildThing("getDeforester");
			this.buildThing("getLaserCutter");
			this.buildThing("getWoodcutter");
		}

		// silicon
		this.buildSilicon();

		// ice
		if (!this.maxedOut("ice")) {
			this.buildThing("getMrFreeze");
			this.buildThing("getFreezer");
			this.buildThing("getIceDrill");
			this.buildThing("getIcePick");
		}

		// silver
		if (!this.maxedOut("silver")) {
			this.buildThing("getCannon");
			this.buildThing("getBertha");
			this.buildThing("getSpaceLaser");
			this.buildThing("getScout");
		}

		// gold
		if (!this.maxedOut("gold")) {
			this.buildThing("getActuator");
			this.buildThing("getDeathStar");
			this.buildThing("getDestroyer");
			this.buildThing("getDroid");
		}

		this.buildMethane();
		this.buildHelium();
		this.buildHydrogen();

		// getBath()
		// getCage()
		// getChemicalPlant();
		// getCloner();
		// getClub();

		// getCondensator();
		// getCrucible();

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
		// getSmasher();
		// getStorage();
		// getTardis();
		// getVeluptuator();
		// getWerewolf();
	},

	upgradeStorage() {
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
		this.injectStatusTab();
		this.tabText("Starting...");
	},

	statusTab: null,

	statusTabName: "automonkeyStatusTab",

	makeStatusTab() {
		this.statusTab = document.createElement("li");
		this.statusTab.id = this.statusTabName;
		this.statusTab.className = "tab";
		this.statusTab.textContent = "Not Running";
		return this.statusTab;
	},

	injectStatusTab() {
		const tabList = document.getElementById("tabList");
		if (tabList && !this.getTab(this.statusTabName)) {
			tabList.appendChild(this.makeStatusTab());
		} else {
			console.error(
				`Failed to inject status tab: tabList not found or tab ${this.statusTabName} already exists.`,
			);
		}
	},

	getTab(tabId) {
		const tabList = document.getElementById("tabList");
		return tabList.querySelector(`#${tabId}`);
	},

	tabText(text) {
		const tab = this.getTab(this.statusTabName);
		if (tab) {
			tab.textContent = text;
		}
	},

	removeTab() {
		const tab = this.getTab(this.statusTabName);
		if (tab) {
			tab.parentNode.removeChild(tab);
			this.statusTab = null;
		}
	},
};

console.debug(monkeyrunner.setup(automonkey));
