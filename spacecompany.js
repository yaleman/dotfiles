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
		return `started at ${new Date().toLocaleTimeString()}`;
	},
};

var automonkey = {
	itemHeadroom: 10,
	powerWanted: 1000,
	maxSwarms: 6,

	message(text) {
		console.debug(`${new Date().toLocaleTimeString()} ${text}`);
		this.statusTabText(`${new Date().toLocaleTimeString()} ${text}`);
	},

	maxedOut(item) {
		return Game.resources.getStorage(item) === window[item];
	},

	run() {
		this.statusTabText(`Running at ${new Date().toLocaleTimeString()} ...`);
		if (ring < 3 && dyson >= 50) {
			buildRing();
		} else if (swarm <= this.maxSwarms && dyson >= 100) {
			buildSwarm();
		} else if (dyson < 250) {
			// console.log("Dyson is below 250, getting more Dyson...");
			getDyson();
		} else {
			buildSphere();
			window.alert("250 Dyson! Sphere bought!");
		}

		this.powerSupplythings();

		// don't need it if we have a huge glut of it
		if (energyps < 20000 || energy <= 0) {
			this.buildPower();
		} else if (sphere === 0 && swarm >= 10 && !energyLow && energy >= 5000) {
			// build things for the final run to get enough resources for the Dyson Sphere
			if (getResource(RESOURCE.Titanium) < dysonTitaniumCost) {
				convertEnergy("titanium");
			} else if (getResource(RESOURCE.Gold) < dysonGoldCost) {
				convertEnergy("gold");
			} else if (getResource(RESOURCE.Silicon) < dysonSiliconCost) {
				convertEnergy("silicon");
			} else if (getResource(RESOURCE.Meteorite) < dysonMeteoriteCost) {
				convertPlasma("meteorite");
			} else if (getResource(RESOURCE.Ice) < dysonIceCost) {
				convertEnergy("ice");
			}
			getDyson();
		}

		if (
			sphere === 1 &&
			(document.getElementById("rebuildStargate").className === "hidden") ===
				false &&
			!energyLow &&
			energy >= 5000
		) {
			if (getResource(RESOURCE.Meteorite) < stargateWonderMeteoriteCost) {
				convertPlasma("meteorite");
			}
			if (getResource(RESOURCE.Plasma) < stargateWonderPlasmaCost) {
				gainResource("plasma");
			}
			if (getResource(RESOURCE.Silicon) < stargateWonderSiliconCost) {
				convertEnergy("silicon");
			}
			if (
				getResource(RESOURCE.Meteorite) >= stargateWonderMeteoriteCost &&
				getResource(RESOURCE.Plasma) >= stargateWonderPlasmaCost &&
				getResource(RESOURCE.Silicon) >= stargateWonderSiliconCost
			) {
				rebuildStargate();
			}
		}

		if (plasmaps >= 23.0 || Game.resources.getStorage("plasma") === plasma) {
			this.buildThing("getWeb");
		}

		this.upgradeStorage();

		this.buyEarlyScience();
		this.buildLabs();

		// rebuildCommsWonder();
		// rebuildStargate();
		// rebuildRocketWonder();
		// rebuildAntimatterWonder();
		// activatePortal();

		this.noPowerThings().map(this.buildThing);

		if (energy > this.powerWanted && !energyLow && energyps > 0) {
			this.buildThings();
		}

		// this.buildPlasma();

		this.manualResource();

		this.toSpace();

		this.statusTabText(
			`Sleeping at ${new Date().toLocaleTimeString()} ... Started at ${this.startDate.toLocaleTimeString()}`,
		);
	},

	manualResource() {
		gainResource("oil");
		gainResource("metal");
		gainResource("wood");
		gainResource("gem");
	},

	buyEarlyScience() {
		purchaseTech("unlockLabT3");
		purchaseTech("unlockLabT2");
		if (
			Game.tech.entries.unlockLabT4.unlocked &&
			Game.tech.entries.unlockLabT4.current === 0
		) {
			purchaseTech("unlockLabT4");
		}
		// purchaseTech("efficiencyResearch");
		purchaseTech("scienceEfficiencyResearch");
		// don't try and buy it if it's already at max level
		if (
			Game.tech.getTechData("energyEfficiencyResearch").current <
			Game.tech.getTechData("energyEfficiencyResearch").maxLevel
		) {
			purchaseTech("energyEfficiencyResearch");
		}
		purchaseTech("unlockStorage");

		purchaseTech("unlockBasicEnergy");
		purchaseTech("unlockSolar");
		purchaseTech("upgradeSolarTech");

		purchaseTech("unlockMachines");
		purchaseTech("upgradeEngineTech");
		purchaseTech("upgradeResourceTech");
		purchaseTech("unlockOil");

		purchaseTech("unlockDestruction");
		purchaseTech("unlockSolarSystem");

		purchaseTech("unlockBatteriesT2");
		purchaseTech("unlockBatteries");
		purchaseTech("unlockRocketFuelT2");
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

	toSpace() {
		// explore("Moon");
		// explore("Mars");
		// explore("Venus");
		// explore("Uranus");
		// explore("Mercury");
		// explore("Neptune");
		// explore("AsteroidBelt");
		// explore("WonderStation");
		// explore("Jupiter");
		// explore("Pluto");
		// explore("KuiperBelt");
	},

	buildPlasma() {
		if (energyps > this.powerWanted) {
			getPlasmatic();
		}
	},

	buildPower() {
		var tempnum = fusionReactor;
		this.buildThing("getFusionReactor");
		if (tempnum < fusionReactor) {
			console.debug("Bought a new fusion reactor");
		}
		tempnum = magmatic;
		this.buildThing("getMagmatic");
		if (tempnum < magmatic) {
			console.debug("Bought a new magmatic generator");
		}

		tempnum = nuclearStation;
		this.buildThing("getNuclearStation");
		if (tempnum < nuclearStation) {
			console.debug("Bought a new nuclear station");
		}

		tempnum = methaneStation;
		this.buildThing("getMethaneStation");
		if (tempnum < methaneStation) {
			console.debug("Bought a new methane station");
		}

		tempnum = solarPanel;
		this.buildThing("getSolarPanel");
		if (tempnum < solarPanel) {
			console.debug("Bought a new solar panel");
		}

		tempnum = charcoalEngine;
		this.buildThing("getCharcoalEngine");
		if (tempnum < charcoalEngine) {
			console.debug("Bought a new charcoal engine");
		}
		// this.buildThing("getBatteryT5");
		// this.buildThing("getBatteryT4");
		// this.buildThing("getBatteryT3");
		// this.buildThing("getBatteryT2");
		// this.buildThing("getBattery");
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
			console.debug(`Need more lava, only getting ${lavaps} < ${psHeadroom}`);
			this.buildLava();
		}
		if (uraniumps < psHeadroom) {
			console.debug(
				`Need more uranium, only getting ${uraniumps} < ${psHeadroom}`,
			);
			getRecycler();
			getCubic();
			getGrinder();
		}
		if (methaneps < psHeadroom) {
			console.debug(
				`Need more methane, only getting ${methaneps} < ${psHeadroom}`,
			);
			this.buildMethane();
		}
		if (charcoalps < psHeadroom) {
			console.debug(
				`Need more charcoal, only getting ${charcoalps} < ${psHeadroom}`,
			);
			this.buildCharcoal();
		}
		if (woodps < psHeadroom) {
			console.debug(`Need more wood, only getting ${woodps} < ${psHeadroom}`);
			this.buildWood(true);
		}

		if (hydrogenps < psHeadroom) {
			console.debug(
				`Need more hydrogen, only getting ${hydrogenps} < ${psHeadroom}`,
			);
			this.buildHydrogen();
		}
		if (heliumps < psHeadroom) {
			console.debug(
				`Need more helium, only getting ${heliumps} < ${psHeadroom}`,
			);
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
			// "getWoodburner", // charcoal
			"getVacuum", // methane
			"getExplorer", // titanium
			"getDroid", // gold
			"getScout", // silver
			"getCollector", // hydrogen
			"getDrone", // helium
			"getIcePick", // ice
		];
	},

	buildLava() {
		if (this.maxedOut("lava")) return;
		getCrucible();
		getExtractor();
		getVeluptuator();
		getExtruder();
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

	buildSilicon(force) {
		if (this.maxedOut("silicon") || !force) return;
		this.buildThing("getBlowtorch");
		this.buildThing("getDesert");
		this.buildThing("getAnnihilator");
		this.buildThing("getScorcher");
	},

	buildWood(force) {
		if (this.maxedOut("wood") || !force) return;
		this.buildThing("getInfuser");
		this.buildThing("getDeforester");
		this.buildThing("getLaserCutter");
		this.buildThing("getWoodcutter");
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
		this.buildWood();

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
		this.buildLava();

		// getBath()
		// getCage()
		// getChemicalPlant();
		// getCloner();
		// getClub();

		// getCondensator();

		// getDiamondChamber();
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
		this.injectCustomTab();
		// this.injectStatusTab();
		// this.statusTabText("Starting...");
	},

	injectCustomTab() {
		const tabList = document.getElementById("tabList");
		const tabContent = document.getElementById("tabContent");
		if (!tabList || !tabContent) {
			console.error("Cannot add Automonkey tab: game tabs are not available.");
			return;
		}

		if (!document.getElementById("automonkeyPanel")) {
			const panel = document.createElement("div");
			panel.id = "automonkeyPanel";
			panel.className = "tab-pane fade";
			panel.setAttribute("role", "tabpanel");
			panel.setAttribute("aria-labelledby", "automonkeyTabLink");
			const greeting = document.createElement("p");
			greeting.textContent = "hello world";
			panel.appendChild(greeting);
			tabContent.appendChild(panel);
		}

		if (!document.getElementById("automonkeyTab")) {
			const tab = document.createElement("li");
			tab.id = "automonkeyTab";
			tab.setAttribute("role", "presentation");
			const link = document.createElement("a");
			link.id = "automonkeyTabLink";
			link.href = "#automonkeyPanel";
			link.textContent = "Automonkey";
			link.setAttribute("role", "tab");
			link.setAttribute("aria-controls", "automonkeyPanel");
			link.setAttribute("data-toggle", "tab");
			tab.appendChild(link);
			tabList.insertBefore(tab, tabList.querySelector(".pull-right"));
		}
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
		}
	},

	getTab(tabId) {
		const tabList = document.getElementById("tabList");
		return tabList.querySelector(`#${tabId}`);
	},

	statusTabText(text) {
		const tab = this.getTab(this.statusTabName);
		if (tab) {
			tab.textContent = text;
		}
	},
};

console.debug(monkeyrunner.setup(automonkey));
