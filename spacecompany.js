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

	producers: {
		energy: [
			"fusionReactor",
			"magmatic",
			"nuclearStation",
			"methaneStation",
			"solarPanel",
			"charcoalEngine",
		],
		plasma: ["bath", "plasmatic", "heater"],
		uranium: ["planetNuke", "recycler", "enricher", "cubic", "grinder"],
		lava: ["condensator", "veluptuator", "extruder", "extractor", "crucible"],
		oil: ["fossilator", "oilRig", "oilField", "pumpjack", "pump"],
		metal: ["multiDrill", "quantumDrill", "gigaDrill", "heavyDrill", "miner"],
		gem: [
			"diamondChamber",
			"carbyneDrill",
			"diamondDrill",
			"advancedDrill",
			"gemMiner",
		],
		charcoal: ["microPollutor", "fryer", "kiln", "furnace", "woodburner"],
		wood: ["forest", "infuser", "deforester", "laserCutter", "woodcutter"],
		silicon: ["tardis", "desert", "annihilator", "scorcher", "blowtorch"],
		lunarite: [
			"cloner",
			"planetExcavator",
			"moonQuarry",
			"moonDrill",
			"moonWorker",
		],
		methane: ["interCow", "vent", "spaceCow", "suctionExcavator", "vacuum"],
		titanium: ["club", "titanDrill", "pentaDrill", "lunariteDrill", "explorer"],
		gold: ["philosopher", "actuator", "deathStar", "destroyer", "droid"],
		silver: ["werewolf", "cannon", "bertha", "spaceLaser", "scout"],
		hydrogen: ["harvester", "hindenburg", "eCell", "magnet", "collector"],
		helium: ["cage", "skimmer", "compressor", "tanker", "drone"],
		ice: ["overexchange", "mrFreeze", "freezer", "iceDrill", "icePick"],
		meteorite: ["nebulous", "smasher", "web", "printer"],
	},

	message(text) {
		console.debug(`${new Date().toLocaleTimeString()} ${text}`);
		this.setMessage(`${new Date().toLocaleTimeString()} ${text}`);
	},

	maxedOut(item) {
		return Game.resources.getStorage(item) === window[item];
	},

	run() {
		if (this.recoverProduction()) return;
		if (this.ensurePlasmaProduction()) return;
		if (this.unlockProgressionResearch()) return;
		if (this.buildMeteoriteProduction()) return;

		this.setMessage(`Running at ${new Date().toLocaleTimeString()} ...`);
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

		this.upgradeStorage();

		this.buyEarlyScience();
		this.buildLabs();

		// rebuildCommsWonder();
		// rebuildStargate();
		// rebuildRocketWonder();
		// rebuildAntimatterWonder();
		// activatePortal();

		this.noPowerThings().map((func) => this.buildThing(func));

		if (energy > this.powerWanted && !energyLow && energyps > 0) {
			this.buildThings();
		}

		// this.buildPlasma();

		this.manualResource();

		this.toSpace();

		this.setMessage(
			`Sleeping at ${new Date().toLocaleTimeString()} ... Started at ${this.startDate.toLocaleTimeString()}`,
		);
	},

	ensurePlasmaProduction() {
		if (Game.resources.getProduction("plasma") !== 0 || window.heater >= 1)
			return false;
		if (!this.tryBuildProducer("plasma", "heater")) return false;
		this.setMessage("Built a Super-Heater to start plasma production.");
		return true;
	},

	hasMeteoritePrerequisites() {
		return ["unlockEmc", "unlockDyson"].every((id) => Game.tech.getTechData(id)?.current > 0);
	},

	buildMeteoriteProduction() {
		if (!this.hasMeteoritePrerequisites() || this.maxedOut("meteorite")) return false;
		for (const producer of this.producers.meteorite) {
			if (this.tryBuildProducer("meteorite", producer)) {
				this.setMessage(`Built ${producer} for meteorite production, keeping at least 1 plasma/s spare.`);
				return true;
			}
		}
		return false;
	},

	recoverProduction() {
		const resources = [...new Set(Object.values(RESOURCE))];
		const deficits = resources.filter(
			(resource) => Game.resources.getProduction(resource) < 0,
		);
		if (deficits.length === 0) return false;

		const summary = deficits
			.map(
				(resource) =>
					`${resource}: ${Game.resources.getProduction(resource).toFixed(0)}/s`,
			)
			.join(", ");
		for (const resource of deficits) {
			for (const producer of this.producers[resource] ?? []) {
				if (this.tryBuildProducer(resource, producer)) {
					this.setMessage(
						`Recovering ${summary} — built ${producer}; checking again next tick.`,
					);
					return true;
				}
			}
		}
		this.setMessage(
			`Recovering ${summary} — waiting for an affordable, unlocked producer with enough input production.`,
		);
		return true;
	},

	tryBuildProducer(resource, producer) {
		const resources = [...new Set(Object.values(RESOURCE))];
		if (!this.canRunProducer(resource, producer, resources)) return false;
		const func = `get${producer[0].toUpperCase()}${producer.slice(1)}`;
		// Legacy purchase functions do not enforce research unlocks or return success.
		const buttons = document.querySelectorAll(`button[onclick="${func}()"]`);
		const unlocked = [...buttons].some((button) => {
			for (let element = button; element; element = element.parentElement) {
				if (
					element.classList.contains("hidden") ||
					element.style.display === "none"
				)
					return false;
			}
			return true;
		});
		if (!unlocked || typeof window[func] !== "function") return false;

		const before = window[producer];
		this.buildThing(func);
		return window[producer] > before;
	},

	canRunProducer(resource, producer, resources) {
		if (window.globalEnergyLock) return false;
		if (resource === "charcoal" && !window.charcoalToggled) return false;
		if (resource === "meteorite" && (!window.meteoriteToggled || !this.hasMeteoritePrerequisites())) return false;
		if (resource === "plasma" && !window[`${producer}Toggled`]) return false;

		for (const input of resources) {
			const suffix = `${input[0].toUpperCase()}${input.slice(1)}Input`;
			let consumption = window[`${producer}${suffix}`] ?? 0;
			if (input === "energy") {
				if (consumption > 0 && window.energyLow) return false;
				consumption *=
					1 - Game.tech.getTechData("energyEfficiencyResearch").current * 0.01;
			}
			if (consumption > 0 && Game.resources.getProduction(input) < consumption)
				return false;
			if (resource === "meteorite" && input === "plasma" && Game.resources.getProduction(input) - consumption < 1)
				return false;
		}
		return true;
	},

	manualResource() {
		gainResource("oil");
		gainResource("metal");
		gainResource("wood");
		gainResource("gem");
	},

	unlockProgressionResearch() {
		let purchased = false;
		const research = ["unlockEmc", "unlockDyson"];
		if (this.hasMeteoritePrerequisites()) research.push("unlockMeteorite", "unlockMeteoriteTier1", "unlockMeteoriteTier2");
		for (const id of research) {
			const tech = Game.tech.getTechData(id);
			if (!tech?.unlocked || tech.current > 0 || !Game.tech.hasResources(tech.cost)) continue;
			purchaseTech(id);
			if (tech.current > 0) {
				this.message(`Researched ${tech.name}`);
				purchased = true;
			}
		}
		return purchased;
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
		document.getElementById("automonkeyStatusTab")?.remove();
		this.setMessage("Starting...");
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
			tabContent.appendChild(panel);
		}

		const panel = document.getElementById("automonkeyPanel");
		for (const greeting of panel.querySelectorAll(":scope > p")) {
			if (greeting.textContent === "hello world") greeting.remove();
		}
		if (!panel.querySelector("#automonkeyMessage")) {
			const message = document.createElement("span");
			message.id = "automonkeyMessage";
			panel.appendChild(message);
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

	setMessage(text) {
		const message = document.getElementById("automonkeyMessage");
		if (message) {
			message.textContent = text;
		}
	},
};

console.debug(monkeyrunner.setup(automonkey));
