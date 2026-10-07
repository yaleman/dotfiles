// biome-ignore lint/correctness/noInvalidUseBeforeDeclaration: "used to reset state"
monkeyrunner?.cancel();

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
		science: ["labT5", "labT4", "labT3", "labT2", "lab"],
	},

	status: Object.freeze({
		SUCCESS: "success",
		LOCKED: "locked",
		DISABLED: "disabled",
		INPUTS: "insufficient-inputs",
		UNAFFORDABLE: "unaffordable",
		COMPLETE: "complete",
		ERROR: "error",
	}),
	budget: null,

	message(text) {
		const message = `${new Date().toLocaleTimeString()} ${text}`;
		console.debug(message);
		this.setMessage(message);
	},

	beginTick() {
		this.budget = Object.fromEntries(
			[...new Set(Object.values(RESOURCE))].map((id) => [
				id,
				Game.resources.getProduction(id),
			]),
		);
		this.energyInputMultiplier = Math.max(
			0,
			1 - Game.tech.getTechData("energyEfficiencyResearch").current * 0.01,
		);
		this.builtThisTick = new Set();
		this.lastAction = null;
	},

	maxedOut(resource) {
		const capacity = Game.resources.getStorage(resource);
		return capacity > 0 && Game.resources.getResource(resource) >= capacity;
	},

	run() {
		try {
			this.beginTick();
			this.manualResource();
			if (this.recoverProduction()) return;
			this.unlockProgressionResearch();
			this.ensurePlasmaProduction();
			this.buildMeteoriteProduction();
			this.buildDyson();
			for (const resource of [
				"lava",
				"uranium",
				"methane",
				"charcoal",
				"wood",
				"hydrogen",
				"helium",
			]) {
				if (this.budget[resource] < Math.max(this.itemHeadroom, 0))
					this.buildProducers(resource);
			}
			if (
				this.budget.energy < 20000 ||
				Game.resources.getResource("energy") <= 0
			)
				this.buildProducers("energy");
			this.rebuildStargate();
			this.upgradeStorage();
			this.buyEarlyScience();
			this.buildProducers("science");
			const powered =
				Game.resources.getResource("energy") > this.powerWanted &&
				!window.energyLow &&
				!window.globalEnergyLock &&
				this.budget.energy > 0;
			for (const resource of Object.keys(this.producers)) {
				if (["energy", "plasma", "meteorite", "science"].includes(resource))
					continue;
				this.buildProducers(resource, !powered);
			}
			this.setMessage(
				this.lastAction ??
					`Sleeping at ${new Date().toLocaleTimeString()} — started at ${this.startDate.toLocaleTimeString()}`,
			);
		} catch (error) {
			monkeyrunner.cancel();
			console.error("Automonkey stopped", error);
			this.setMessage(`Stopped: ${String(error)}`);
		}
	},

	isActionAvailable(func) {
		if (typeof window[func] !== "function") return false;
		return [...document.querySelectorAll(`button[onclick="${func}()"]`)].some(
			(button) => this.isElementAvailable(button),
		);
	},

	isElementAvailable(element) {
		if (!element) return false;
		for (; element; element = element.parentElement) {
			if (
				element.classList.contains("hidden") ||
				element.style.display === "none" ||
				element.disabled
			)
				return false;
			if (element.parentElement?.id === "tabContent") {
				const navigation = document.querySelector(
					`#tabList [href="#${element.id}"]`,
				);
				if (!this.isElementAvailable(navigation)) return false;
			}
		}
		return true;
	},

	isResourceAvailable(resource) {
		// Legacy research updates navigation visibility, not resource-entry unlock flags.
		return this.isElementAvailable(document.getElementById(`${resource}Nav`));
	},

	producerInputs(producer) {
		const inputs = {};
		for (const resource of Object.keys(this.budget)) {
			const suffix = `${resource[0].toUpperCase()}${resource.slice(1)}Input`;
			const amount = window[`${producer}${suffix}`] ?? 0;
			inputs[resource] =
				resource === "energy" ? amount * this.energyInputMultiplier : amount;
		}
		return inputs;
	},

	checkProducer(resource, producer) {
		const func = `get${producer[0].toUpperCase()}${producer.slice(1)}`;
		if (!this.isActionAvailable(func))
			return { kind: this.status.LOCKED, producer };
		if (this.builtThisTick.has(producer))
			return { kind: this.status.COMPLETE, producer };
		const inputs = this.producerInputs(producer);
		if (
			(window.globalEnergyLock &&
				(resource === "energy" || inputs.energy > 0)) ||
			(window.energyLow && inputs.energy > 0) ||
			(resource === "charcoal" && !window.charcoalToggled) ||
			(resource === "meteorite" &&
				(!window.meteoriteToggled || !this.hasMeteoritePrerequisites())) ||
			(resource === "plasma" && !window[`${producer}Toggled`])
		) {
			return { kind: this.status.DISABLED, producer };
		}
		for (const [input, consumption] of Object.entries(inputs)) {
			const reserve = resource === "meteorite" && input === "plasma" ? 1 : 0;
			if (
				(consumption > 0 || reserve > 0) &&
				this.budget[input] < consumption + reserve
			) {
				return {
					kind: this.status.INPUTS,
					producer,
					input,
					required: consumption + reserve,
					available: this.budget[input],
				};
			}
		}
		return { kind: this.status.SUCCESS, producer, func, inputs };
	},

	tryBuildProducer(resource, producer) {
		const checked = this.checkProducer(resource, producer);
		if (checked.kind !== this.status.SUCCESS) return checked;
		try {
			const before = window[producer];
			if (!Number.isFinite(before))
				throw new Error(`Missing building count: ${producer}`);
			window[checked.func]();
			if (window[producer] <= before)
				return { kind: this.status.UNAFFORDABLE, producer };
			for (const [input, consumption] of Object.entries(checked.inputs))
				this.budget[input] -= consumption;
			// New production is deliberately not credited until the game refreshes next tick.
			this.builtThisTick.add(producer);
			return { kind: this.status.SUCCESS, producer };
		} catch (error) {
			return { kind: this.status.ERROR, producer, error };
		}
	},

	recordResult(result, successMessage) {
		switch (result.kind) {
			case this.status.SUCCESS:
				this.lastAction = successMessage;
				this.message(successMessage);
				return true;
			case this.status.ERROR:
				throw result.error;
			default:
				return false;
		}
	},

	buildProducers(resource, freeOnly = false) {
		if (this.maxedOut(resource)) return;
		for (const producer of this.producers[resource]) {
			if (
				freeOnly &&
				Object.values(this.producerInputs(producer)).some(
					(amount) => amount > 0,
				)
			)
				continue;
			this.recordResult(
				this.tryBuildProducer(resource, producer),
				`Built ${producer}`,
			);
		}
	},

	recoverProduction() {
		const deficits = Object.keys(this.budget).filter(
			(resource) => this.budget[resource] < 0,
		);
		if (deficits.length === 0) return false;
		const summary = deficits
			.map((resource) => `${resource}: ${this.budget[resource].toFixed(0)}/s`)
			.join(", ");
		const blocked = [];
		for (const resource of deficits) {
			for (const producer of this.producers[resource] ?? []) {
				const result = this.tryBuildProducer(resource, producer);
				if (
					this.recordResult(
						result,
						`Recovering ${summary} — built ${producer}; checking again next tick.`,
					)
				)
					return true;
				blocked.push(result);
			}
		}
		const reason =
			blocked.find((result) => result.kind === this.status.UNAFFORDABLE) ??
			blocked.find((result) => result.kind === this.status.INPUTS) ??
			blocked.find((result) => result.kind === this.status.DISABLED) ??
			blocked[0];
		let detail = "no producer is available";
		if (reason) {
			switch (reason.kind) {
				case this.status.UNAFFORDABLE:
					detail = `${reason.producer} needs construction resources`;
					break;
				case this.status.INPUTS:
					detail = `${reason.producer} needs ${reason.required.toFixed(0)} ${reason.input}/s, available ${reason.available.toFixed(0)}/s`;
					break;
				case this.status.DISABLED:
					detail = `${reason.producer} production is disabled or power-starved`;
					break;
				case this.status.LOCKED:
					detail = `${reason.producer} needs its unlock`;
					break;
			}
		}
		this.setMessage(`Recovering ${summary} — waiting: ${detail}.`);
		return true;
	},

	ensurePlasmaProduction() {
		if (this.budget.plasma === 0 && window.heater < 1) {
			return this.recordResult(
				this.tryBuildProducer("plasma", "heater"),
				"Built a Super-Heater to start plasma production.",
			);
		}
		return false;
	},

	hasMeteoritePrerequisites() {
		return ["unlockEmc", "unlockDyson"].every(
			(id) => Game.tech.getTechData(id)?.current > 0,
		);
	},

	meteoriteCost(producer) {
		const materials = {
			printer: ["lunarite", "silicon"],
			web: ["lunarite", "uranium", "silicon"],
			smasher: ["silicon", "silver", "gem"],
			nebulous: ["lunarite", "lava", "gold"],
		};
		return Object.fromEntries(
			materials[producer].map((resource) => [
				resource,
				window[
					`${producer}${resource[0].toUpperCase()}${resource.slice(1)}Cost`
				] * (producer === "printer" ? window.T1Price : 1),
			]),
		);
	},

	buildMeteoriteProduction() {
		if (
			!this.hasMeteoritePrerequisites() ||
			!window.meteoriteToggled ||
			this.maxedOut("meteorite")
		)
			return;
		for (const producer of this.producers.meteorite) {
			const func = `get${producer[0].toUpperCase()}${producer.slice(1)}`;
			if (
				!this.isActionAvailable(func) ||
				!this.hasResources(this.meteoriteCost(producer))
			)
				continue;
			const result = this.tryBuildProducer("meteorite", producer);
			if (result.kind === this.status.INPUTS && result.input === "plasma") {
				for (const plasmaProducer of this.producers.plasma) {
					if (
						this.recordResult(
							this.tryBuildProducer("plasma", plasmaProducer),
							`Built ${plasmaProducer} to supply ${producer} and keep 1 plasma/s spare.`,
						)
					)
						return;
				}
			} else if (
				this.recordResult(
					result,
					`Built ${producer}, keeping at least 1 plasma/s spare.`,
				)
			)
				return;
			// This is the strongest unlocked producer we can afford; grow its plasma supply first.
			return;
		}
	},

	hasResources(cost) {
		return Object.entries(cost).every(
			([resource, amount]) =>
				Number.isFinite(amount) &&
				Game.resources.getResource(resource) >= amount,
		);
	},

	researchCost(id) {
		const tech = Game.tech.getTechData(id);
		return Object.fromEntries(
			Object.entries(tech.cost).map(([resource, cost]) => [
				resource,
				getCost(cost, tech.current),
			]),
		);
	},

	buyResearch(id) {
		return this.recordResult(
			this.tryBuyResearch(id),
			`Researched ${Game.tech.getTechData(id)?.name ?? id}`,
		);
	},

	buyMeteoriteResearch() {
		for (const id of [
			"unlockMeteorite",
			"unlockMeteoriteTier1",
			"unlockMeteoriteTier2",
		])
			this.buyResearch(id);
	},

	tryBuyResearch(id) {
		const tech = Game.tech.getTechData(id);
		if (!tech?.unlocked) return { kind: this.status.LOCKED, id };
		if (tech.maxLevel > 0 && tech.current >= tech.maxLevel)
			return { kind: this.status.COMPLETE, id };
		if (!this.hasResources(this.researchCost(id)))
			return { kind: this.status.UNAFFORDABLE, id };
		try {
			const before = tech.current;
			purchaseTech(id);
			return {
				kind:
					tech.current > before
						? this.status.SUCCESS
						: this.status.UNAFFORDABLE,
				id,
			};
		} catch (error) {
			return { kind: this.status.ERROR, id, error };
		}
	},

	unlockProgressionResearch() {
		this.buyMeteoriteResearch();
		for (const [id, func, cost] of [
			[
				"unlockPlasma",
				"unlockPlasmaResearch",
				{ hydrogen: 1500, uranium: 1500, oil: 15000, wood: 15000 },
			],
			["unlockEmc", "unlockEmcResearch", { energy: 75000, plasma: 100 }],
			["unlockDyson", "unlockDysonResearch", { energy: 100000, plasma: 10000 }],
		]) {
			const tech = Game.tech.getTechData(id);
			if (
				tech &&
				!tech.unlocked &&
				tech.current === 0 &&
				this.isActionAvailable(func) &&
				this.hasResources(cost)
			)
				window[func]();
			this.buyResearch(id);
			this.buyMeteoriteResearch();
		}
		for (const id of ["unlockPlasmaTier2", "unlockDysonSphere"])
			this.buyResearch(id);
	},

	buyEarlyScience() {
		for (const id of [
			"unlockBasicEnergy",
			"unlockSolar",
			"unlockMachines",
			"unlockOil",
			"unlockSolarSystem",
			"unlockStorage",
			"unlockLabT2",
			"unlockLabT3",
			"unlockLabT4",
			"unlockRocketFuelT2",
			"unlockDestruction",
			"upgradeSolarTech",
			"upgradeEngineTech",
			"upgradeResourceTech",
		])
			this.buyResearch(id);
		if (!Game.tech.getTechData("unlockLabT4")?.current) return;
		for (const id of [
			"unlockPSU",
			"unlockPSUT2",
			"unlockBatteries",
			"unlockBatteriesT2",
			"unlockBatteriesT3",
			"unlockBatteriesT4",
		])
			this.buyResearch(id);
		this.buyEfficiencyResearch();
	},

	buyEfficiencyResearch() {
		const science = "scienceEfficiencyResearch";
		const energy = "energyEfficiencyResearch";
		const resource = "efficiencyResearch";
		const energyTech = Game.tech.getTechData(energy);
		const energyComplete =
			energyTech?.maxLevel > 0 && energyTech.current >= energyTech.maxLevel;
		const cost = (id) =>
			Game.tech.getTechData(id) ? this.researchCost(id).science : Infinity;
		const priorities = energyComplete ? [science, resource] : [science, energy];
		const cheapResource =
			cost(resource) < Math.min(cost(science), cost(energy)) * 0.1;
		priorities.sort((a, b) => cost(a) - cost(b));
		for (const id of priorities) this.buyResearch(id);
		if (
			!energyComplete &&
			(cheapResource ||
				(energyTech?.maxLevel > 0 && energyTech.current >= energyTech.maxLevel))
		)
			this.buyResearch(resource);
	},

	buildDyson() {
		if (!Game.tech.getTechData("unlockDyson")?.current) return;
		let target;
		if (window.ring < 3) target = "ring";
		else if (window.swarm < this.maxSwarms) target = "swarm";
		else target = "sphere";
		const assemblyUnlocked =
			target === "ring" ||
			Game.tech.getTechData("unlockDysonSphere")?.current > 0;
		if (
			target === "sphere" &&
			window.sphere > Game.interstellar.stars.systemsConquered
		)
			return;
		const capitalized = `${target[0].toUpperCase()}${target.slice(1)}`;
		// These game constants are global lexical bindings, not window properties.
		const costs = {
			ring: { segments: ringSegmentCost, fuel: ringRocketFuelCost },
			swarm: { segments: swarmSegmentCost, fuel: swarmRocketFuelCost },
			sphere: { segments: sphereSegmentCost, fuel: sphereRocketFuelCost },
		};
		const { segments: segmentCost, fuel: rocketCost } = costs[target];
		const func = `build${capitalized}`;
		if (
			assemblyUnlocked &&
			window.dyson >= segmentCost &&
			Game.resources.getResource("rocketFuel") >= rocketCost &&
			this.isActionAvailable(func)
		) {
			const before = window[target];
			window[func]();
			if (window[target] > before) {
				this.lastAction = `Built Dyson ${target}`;
				this.message(this.lastAction);
				return;
			}
		}
		if (window.dyson >= segmentCost || !this.isActionAvailable("getDyson"))
			return;
		if (
			window.sphere === 0 &&
			window.ring >= 3 &&
			window.swarm >= this.maxSwarms &&
			!window.energyLow &&
			!window.globalEnergyLock &&
			Game.resources.getResource("energy") >= 5000
		) {
			for (const resource of [
				"titanium",
				"gold",
				"silicon",
				"meteorite",
				"ice",
			]) {
				const cost =
					window[`dyson${resource[0].toUpperCase()}${resource.slice(1)}Cost`];
				if (Game.resources.getResource(resource) < cost) {
					this.convertResource(resource);
					break;
				}
			}
		}
		const before = window.dyson;
		getDyson();
		if (window.dyson > before) {
			this.lastAction = "Built Dyson segment";
			this.message(this.lastAction);
		}
	},

	convertResource(resource) {
		if (!Game.tech.getTechData("unlockEmc")?.current) return;
		if (resource === "meteorite") {
			if (Game.tech.getTechData("unlockMeteorite")?.current)
				convertPlasma(resource);
		} else if (this.isResourceAvailable(resource)) convertEnergy(resource);
	},

	rebuildStargate() {
		if (
			window.sphere !== 1 ||
			window.energyLow ||
			window.globalEnergyLock ||
			Game.resources.getResource("energy") < 5000 ||
			!this.isActionAvailable("rebuildStargate")
		)
			return;
		if (
			Game.resources.getResource("meteorite") <
			window.stargateWonderMeteoriteCost
		)
			this.convertResource("meteorite");
		if (
			Game.resources.getResource("plasma") < window.stargateWonderPlasmaCost &&
			Game.tech.getTechData("unlockPlasma")?.current
		)
			gainResource("plasma");
		if (
			Game.resources.getResource("silicon") < window.stargateWonderSiliconCost
		)
			this.convertResource("silicon");
		if (
			this.hasResources({
				meteorite: window.stargateWonderMeteoriteCost,
				plasma: window.stargateWonderPlasmaCost,
				silicon: window.stargateWonderSiliconCost,
			})
		)
			rebuildStargate();
	},

	manualResource() {
		for (const resource of ["oil", "metal", "wood", "gem"]) {
			if (this.isResourceAvailable(resource)) gainResource(resource);
		}
	},

	upgradeStorage() {
		if (!Game.tech.getTechData("unlockStorage")?.current) return;
		for (const resource of Object.keys(this.producers)) {
			if (
				["energy", "plasma", "science"].includes(resource) ||
				!this.isResourceAvailable(resource)
			)
				continue;
			const func = `upgrade${resource[0].toUpperCase()}${resource.slice(1)}Storage`;
			if (this.isActionAvailable(func)) window[func]();
		}
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
