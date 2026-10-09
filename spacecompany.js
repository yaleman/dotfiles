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
	minimumEnergyRunway: 4 * 60 * 60,
	energyRunwayStorageKey: "automonkey.minimumEnergyRunwayHours",
	maxSwarms: 6,
	wonders: [
		[
			"Precious wonder",
			"achievePreciousWonder",
			"preciousWonderButton",
			"precious",
			["gem", "silver", "gold"],
		],
		[
			"Precious wonder activation",
			"activatePreciousWonder",
			"activatePreciousWonder",
			"preciousActivate",
			["gem", "silver", "gold"],
			"preciousWonderNav",
		],
		[
			"Energetic wonder",
			"achieveEnergeticWonder",
			"energeticWonderButton",
			"energetic",
			["wood", "charcoal", "uranium"],
		],
		[
			"Energetic wonder activation",
			"activateEnergeticWonder",
			"activateEnergeticWonder",
			"energeticActivate",
			["wood", "charcoal", "uranium"],
			"energeticWonderNav",
		],
		[
			"Technological wonder",
			"achieveTechWonder",
			"techWonderButton",
			"tech",
			["silicon", "gold", "gem"],
		],
		[
			"Technological wonder activation",
			"activateTechWonder",
			"activateTechWonder",
			"techActivate",
			["silicon", "gold", "gem"],
			"techWonderNav",
		],
		[
			"Meteorite wonder",
			"achieveMeteoriteWonder",
			"meteoriteWonderButton",
			"meteorite",
			["meteorite", "ice", "silicon"],
		],
		[
			"Meteorite wonder activation",
			"activateMeteoriteWonder",
			"activateMeteoriteWonder",
			"meteoriteActivate",
			["meteorite", "ice", "silicon"],
			"meteoriteWonderNav",
		],
		[
			"Communication wonder",
			"rebuildCommsWonder",
			"rebuildCommsWonder",
			"commsWonder",
			["gold", "silicon", "ice"],
			"communicationWonderNav",
		],
		[
			"Rocket wonder",
			"rebuildRocketWonder",
			"rebuildRocketWonder",
			"rocketWonder",
			["lunarite", "titanium", "metal"],
			"rocketWonderNav",
		],
		[
			"Antimatter wonder",
			"rebuildAntimatterWonder",
			"rebuildAntimatterWonder",
			"antimatterWonder",
			["uranium", "lava", "oil", "methane"],
			"antimatterWonderNav",
		],
		[
			"Portal",
			"activatePortal",
			"activatePortal",
			"portal",
			["meteorite", "helium", "silicon"],
			"portalRoomNav",
		],
		[
			"Stargate",
			"rebuildStargate",
			"rebuildStargate",
			"stargateWonder",
			["plasma", "silicon", "meteorite"],
			"stargateNav",
		],
	],

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
		this.plasmaPlan = null;
	},

	maxedOut(resource) {
		const capacity = Game.resources.getStorage(resource);
		return capacity > 0 && Game.resources.getResource(resource) >= capacity;
	},

	energySecondsRemaining(
		netPerSecond = Game.resources.getProduction("energy"),
	) {
		return netPerSecond < 0
			? Math.max(0, Game.resources.getResource("energy")) / -netPerSecond
			: Infinity;
	},

	energySecondsAtDeficit(deficitPerSecond) {
		return this.energySecondsRemaining(-Math.abs(deficitPerSecond));
	},

	energySecondsAfterConsumption(additionalPerSecond) {
		const net = this.budget?.energy ?? Game.resources.getProduction("energy");
		return this.energySecondsRemaining(net - additionalPerSecond);
	},

	run() {
		try {
			this.beginTick();
			this.manualResource();
			this.buyWonders();
			if (this.recoverProduction()) {
				this.unlockProgressionResearch(false);
				this.buyEarlyScience();
				this.buildProducers("science", true);
				this.setMessage(
					[
						...new Set([this.recoveryMessage, this.lastAction].filter(Boolean)),
					].join("\n"),
				);
				this.updatePlan(
					"Recovering resource production. Science-funded research and science buildings continue; other building purchases are paused.",
				);
				return;
			}
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
					this.buildProducers(resource, false, true);
			}
			if (
				this.budget.energy < 20000 ||
				Game.resources.getResource("energy") <= 0
			)
				this.buildProducers("energy", false, true);
			this.prepareStargate();
			this.buyWonders();
			this.upgradeStorage();
			this.buyEarlyScience();
			this.buildProducers("science");
			const powered =
				Game.resources.getResource("energy") > this.powerWanted &&
				!window.energyLow &&
				!window.globalEnergyLock &&
				this.energySecondsAfterConsumption(0) >= this.minimumEnergyRunway;
			for (const resource of Object.keys(this.producers)) {
				if (["energy", "plasma", "meteorite", "science"].includes(resource))
					continue;
				this.buildProducers(resource, !powered);
			}
			this.setMessage(
				this.lastAction ??
					`Sleeping at ${new Date().toLocaleTimeString()} — started at ${this.startDate.toLocaleTimeString()}`,
			);
			this.updatePlan();
		} catch (error) {
			monkeyrunner.cancel();
			console.error("Automonkey stopped", error);
			this.setMessage(`Stopped: ${String(error)}`);
			const plan = document.getElementById("automonkeyPlan");
			if (plan) plan.textContent = "Automation stopped. Research is paused.";
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
				input === "energy" &&
				consumption > 0 &&
				this.energySecondsAfterConsumption(consumption) >=
					this.minimumEnergyRunway
			)
				continue;
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
					...(input === "energy"
						? {
								secondsRemaining:
									this.energySecondsAfterConsumption(consumption),
								requiredSeconds: this.minimumEnergyRunway,
							}
						: {}),
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

	buildProducers(resource, freeOnly = false, productionNeeded = false) {
		if (!productionNeeded && this.maxedOut(resource)) return;
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
			(resource) =>
				this.budget[resource] < 0 &&
				(resource !== "energy" ||
					this.energySecondsAfterConsumption(0) < this.minimumEnergyRunway),
		);
		if (deficits.length === 0) return false;
		const summary = deficits
			.map((resource) => `${resource}: ${this.budget[resource].toFixed(0)}/s`)
			.join(", ");
		const blocked = [];
		for (const resource of deficits) {
			const plasma = resource === "plasma" ? this.selectPlasmaProducer() : null;
			const producers =
				resource === "plasma"
					? plasma
						? [plasma.producer]
						: []
					: (this.producers[resource] ?? []);
			for (const producer of producers) {
				const result =
					plasma && plasma.kind !== this.status.SUCCESS
						? plasma
						: this.tryBuildProducer(resource, producer);
				if (
					this.recordResult(
						result,
						`Recovering ${summary} — built ${producer}; checking again next tick.`,
					)
				) {
					this.recoveryMessage = this.lastAction;
					return true;
				}
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
					detail = `${reason.producer} needs construction resources${reason.cost ? `. ${this.affordabilityCountdown(reason.cost)}` : ""}`;
					break;
				case this.status.INPUTS:
					detail =
						reason.input === "energy"
							? `${reason.producer} would leave ${(reason.secondsRemaining / 3600).toFixed(0)}h of energy; needs at least ${reason.requiredSeconds / 3600}h`
							: `${reason.producer} needs ${reason.required.toFixed(0)} ${reason.input}/s, available ${reason.available.toFixed(0)}/s`;
					break;
				case this.status.DISABLED:
					detail = `${reason.producer} production is disabled or power-starved`;
					break;
				case this.status.LOCKED:
					detail = `${reason.producer} needs its unlock`;
					break;
			}
		}
		this.recoveryMessage = `Recovering ${summary} — waiting: ${detail}.`;
		this.setMessage(this.recoveryMessage);
		return true;
	},

	ensurePlasmaProduction() {
		if (
			this.budget.plasma === 0 &&
			this.producers.plasma.every((producer) => !(window[producer] > 0))
		)
			return this.buildPlasmaSupply("start plasma production");
		return false;
	},

	plasmaCost(producer) {
		const materials = {
			heater: ["lunarite", "gem", "silicon"],
			plasmatic: ["lunarite", "silicon", "meteorite"],
			bath: ["lava", "gold", "meteorite"],
		};
		return Object.fromEntries(
			materials[producer].map((resource) => [
				resource,
				window[
					`${producer}${resource[0].toUpperCase()}${resource.slice(1)}Cost`
				] * (producer === "heater" ? window.T1Price : 1),
			]),
		);
	},

	selectPlasmaProducer() {
		if (
			this.producers.plasma.some((producer) => this.builtThisTick.has(producer))
		)
			return null;
		const efficiency = (producer) => {
			const output = window[`${producer}Output`];
			const energy = this.producerInputs(producer).energy;
			return output > 0 ? (energy > 0 ? output / energy : Infinity) : 0;
		};
		for (const producer of [...this.producers.plasma].sort(
			(a, b) => efficiency(b) - efficiency(a),
		)) {
			if (efficiency(producer) === 0) continue;
			const checked = this.checkProducer("plasma", producer);
			if (checked.kind !== this.status.SUCCESS) continue;
			const cost = this.plasmaCost(producer);
			if (this.hasResources(cost)) return { ...checked, cost };
			const canSave = Object.entries(cost).every(([resource, amount]) => {
				if (!Number.isFinite(amount)) return false;
				if (Game.resources.getResource(resource) >= amount) return true;
				const capacity = Game.resources.getStorage(resource);
				return (
					(capacity < 0 || capacity >= amount) &&
					Game.resources.getProduction(resource) > 0
				);
			});
			if (canSave) return { kind: this.status.UNAFFORDABLE, producer, cost };
		}
		return null;
	},

	buildPlasmaSupply(purpose) {
		const selected = this.selectPlasmaProducer();
		if (!selected) return false;
		if (selected.kind === this.status.UNAFFORDABLE) {
			this.lastAction = `Saving for ${selected.producer} to ${purpose}.\n${this.affordabilityCountdown(selected.cost)}`;
			this.plasmaPlan = this.lastAction;
			this.setMessage(this.lastAction);
			return false;
		}
		return this.recordResult(
			this.tryBuildProducer("plasma", selected.producer),
			`Built ${selected.producer} to ${purpose}.`,
		);
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
				this.buildPlasmaSupply(`supply ${producer} and keep 1 plasma/s spare`);
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

	unlockProgressionResearch(resourceUnlocks = true) {
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
				resourceUnlocks &&
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

	buyWonders() {
		for (const [name, func, completed, prefix, resources, navigation] of this
			.wonders) {
			if (
				navigation &&
				!this.isElementAvailable(document.getElementById(navigation))
			)
				continue;
			if (
				window.buttonsHidden?.includes(completed) ||
				!this.isActionAvailable(func)
			)
				continue;
			const cost = Object.fromEntries(
				resources.map((resource) => [
					resource,
					window[
						`${prefix}${resource[0].toUpperCase()}${resource.slice(1)}Cost`
					],
				]),
			);
			if (!this.hasResources(cost)) continue;
			window[func]();
			if (window.buttonsHidden?.includes(completed))
				this.recordResult({ kind: this.status.SUCCESS }, `Completed ${name}`);
		}
	},

	prepareStargate() {
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
		try {
			const hours = localStorage.getItem(this.energyRunwayStorageKey);
			if (hours !== null) this.setEnergyRunwayHours(Number(hours), false);
		} catch (error) {
			console.error("Could not restore Automonkey energy setting", error);
		}
		this.injectCustomTab();
		document.getElementById("automonkeyStatusTab")?.remove();
		this.setMessage("Starting...");
		this.updatePlan();
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
		panel.style.fontSize = "200%";
		if (!panel.querySelector("#automonkeyEnergyRunway")) {
			const control = document.createElement("p");
			const label = document.createElement("label");
			label.htmlFor = "automonkeyEnergyRunway";
			label.appendChild(document.createTextNode("Minimum energy runway: "));
			const value = document.createElement("span");
			value.id = "automonkeyEnergyRunwayValue";
			label.appendChild(value);
			const slider = document.createElement("input");
			slider.id = "automonkeyEnergyRunway";
			slider.type = "range";
			slider.min = "1";
			slider.max = "24";
			slider.step = "1";
			control.appendChild(label);
			control.appendChild(slider);
			panel.appendChild(control);
		}
		const slider = panel.querySelector("#automonkeyEnergyRunway");
		slider.oninput = () => this.setEnergyRunwayHours(Number(slider.value));
		this.updateEnergyRunwayControl();
		if (!panel.querySelector("#automonkeyPlan")) {
			const plan = document.createElement("p");
			plan.id = "automonkeyPlan";
			panel.appendChild(plan);
		}
		panel.querySelector("#automonkeyPlan").style.whiteSpace = "pre-line";
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
			tabList.insertBefore(tab, tabList.querySelector(":scope > .pull-right"));
		}
	},

	setMessage(text) {
		const message = document.getElementById("automonkeyMessage");
		if (message) {
			message.textContent = text;
		}
	},

	setEnergyRunwayHours(hours, persist = true) {
		if (!Number.isInteger(hours) || hours < 1 || hours > 24) return false;
		this.minimumEnergyRunway = hours * 60 * 60;
		this.updateEnergyRunwayControl();
		this.updatePlan();
		if (persist) {
			try {
				localStorage.setItem(this.energyRunwayStorageKey, String(hours));
			} catch (error) {
				console.error("Could not save Automonkey energy setting", error);
				this.setMessage(
					"Energy setting applied, but could not save it to localStorage.",
				);
			}
		}
		return true;
	},

	updateEnergyRunwayControl() {
		const hours = this.minimumEnergyRunway / 3600;
		const slider = document.getElementById("automonkeyEnergyRunway");
		if (slider) slider.value = String(hours);
		const value = document.getElementById("automonkeyEnergyRunwayValue");
		if (value) value.textContent = `${hours} ${hours === 1 ? "hour" : "hours"}`;
	},

	secondsUntilAffordable(cost) {
		let seconds = 0;
		for (const [resource, amount] of Object.entries(cost)) {
			const remaining = amount - Game.resources.getResource(resource);
			if (remaining <= 0) continue;
			const production = Game.resources.getProduction(resource);
			if (production <= 0) return Infinity;
			seconds = Math.max(seconds, remaining / production);
		}
		return seconds;
	},

	affordabilityCountdown(cost) {
		const seconds = this.secondsUntilAffordable(cost);
		if (seconds === 0) return "Resources ready.";
		if (!Number.isFinite(seconds))
			return "No countdown available: a required resource is not increasing.";
		const total = Math.ceil(seconds);
		const hours = Math.floor(total / 3600);
		const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
		const remainder = String(total % 60).padStart(2, "0");
		return `Estimated ready in ${hours}h ${minutes}m ${remainder}s at current production.`;
	},

	sciencePlan() {
		const waiting = (id, name) => {
			const tech = Game.tech.getTechData(id);
			return tech?.unlocked
				? `Waiting for ${name}: ${Game.resources.getResource("science").toFixed(0)} / ${this.researchCost(id).science.toFixed(0)} science.\n${this.affordabilityCountdown(this.researchCost(id))}`
				: `Waiting for ${name} to become available.`;
		};
		const meteorite = [
			"unlockMeteorite",
			"unlockMeteoriteTier1",
			"unlockMeteoriteTier2",
		].find((id) => {
			const tech = Game.tech.getTechData(id);
			return tech?.unlocked && !tech.current;
		});
		if (meteorite)
			return `${waiting(meteorite, Game.tech.getTechData(meteorite).name ?? "meteorite research")}\nMeteorite research takes priority.`;
		if (!Game.tech.getTechData("unlockLabT4")?.current)
			return `${waiting("unlockLabT4", "T4 science")}\nBatteries, PSUs and efficiency upgrades wait until T4 is complete.`;
		const storage = [
			"unlockPSU",
			"unlockPSUT2",
			"unlockBatteries",
			"unlockBatteriesT2",
			"unlockBatteriesT3",
			"unlockBatteriesT4",
		].find((id) => {
			const tech = Game.tech.getTechData(id);
			return tech?.unlocked && !tech.current;
		});
		if (storage)
			return `T4 science complete.\n${waiting(storage, Game.tech.getTechData(storage).name ?? storage)}\nEfficiency upgrades use any remaining science.`;
		const energy = Game.tech.getTechData("energyEfficiencyResearch");
		if (energy?.maxLevel > 0 && energy.current >= energy.maxLevel)
			return "Energy efficiency is maxed out.\nScience and resource efficiency have equal priority: buy the cheaper available upgrade first.";
		return `Focusing on science and energy efficiency${energy ? ` (energy ${energy.current.toFixed(0)} / ${energy.maxLevel.toFixed(0)})` : ""}.\nResource efficiency is allowed only when its next upgrade costs less than 10% of both.\nBuy the cheaper priority upgrade first.`;
	},

	updatePlan(prefix = "") {
		const plan = document.getElementById("automonkeyPlan");
		if (plan) {
			const seconds = this.energySecondsAfterConsumption(0);
			const powerPlan = Number.isFinite(seconds)
				? `Energy runway: ${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m.\nNew powered buildings must leave at least ${this.minimumEnergyRunway / 3600}h.`
				: `Powered buildings may use energy reserves if at least ${this.minimumEnergyRunway / 3600}h remain after purchase.`;
			plan.textContent = [
				prefix.trim() ||
					"Building affordable resource, power and science producers as inputs allow.",
				this.sciencePlan(),
				this.plasmaPlan,
				powerPlan,
			]
				.filter(Boolean)
				.join("\n");
		}
	},
};

console.debug(monkeyrunner.setup(automonkey));
