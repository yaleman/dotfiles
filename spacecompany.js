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
	start() {
		if (this.timeoutID === null)
			this.timeoutID = setInterval(() => {
				this.myMonkey.run();
				this.myMonkey.runAutoEmc();
			}, 1000);
	},
	setup(targetMonkey) {
		this.myMonkey = targetMonkey;
		if (typeof this.timeoutID === "number") {
			this.cancel();
		}
		this.myMonkey.setup();
		this.start();
		return `started at ${new Date().toLocaleTimeString()}`;
	},
};

var automonkey = {
	enabled: true,
	autoEmcEnabled: false,
	autoEmcResource: "metal",
	itemHeadroom: 10,
	powerWanted: 1000,
	minimumEnergyRunway: 4 * 60 * 60,
	energyRunwayStorageKey: "automonkey.minimumEnergyRunwayHours",
	maxSwarms: 6,
	batteryProducers: [
		"batteryT5",
		"batteryT4",
		"batteryT3",
		"batteryT2",
		"battery",
	],
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
		rocketFuel: ["hydrazine", "oxidisation", "chemicalPlant"],
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
		if (typeof window.calculateEnergyOutput === "function") {
			let consumption = 0;
			if (!window.globalEnergyLock) {
				for (const [resource, producers] of Object.entries(this.producers)) {
					if (resource === "charcoal" && !window.charcoalToggled) continue;
					for (const producer of producers) {
						if (resource === "plasma" && !window[`${producer}Toggled`])
							continue;
						consumption +=
							(window[producer] ?? 0) *
							(this.producerInputs(producer).energy ?? 0);
					}
				}
			}
			// The game's sampled rate can omit plasma consumption while its stock is low.
			this.budget.energy = Math.min(
				this.budget.energy,
				window.calculateEnergyOutput(1) - consumption,
			);
		}
		this.builtThisTick = new Set();
		this.lastAction = null;
		this.plasmaPlan = null;
		this.buildingPlans = new Map();
		this.rocketPlan = null;
		this.explorationPlan = null;
		this.interstellarPlan = null;
		this.interstellarSavings = null;
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
		if (!this.enabled) return;
		try {
			if (
				Number.isFinite(Game.lastFixedUpdate) &&
				Date.now() - Game.lastFixedUpdate > 2000
			) {
				this.setMessage(
					"Waiting for the game to refresh production; purchases are paused.",
				);
				const plan = document.getElementById("automonkeyPlan");
				if (plan)
					plan.textContent =
						"Production data is stale. Automation will resume after the game updates.";
				return;
			}
			this.beginTick();
			this.manualResource();
			this.workInterstellar();
			this.buyWonders();
			this.buyRocket();
			const recovering = this.recoverProduction();
			this.exploreSolarSystem(!recovering);
			if (recovering) {
				this.unlockProgressionResearch(false);
				this.buyEarlyScience();
				this.buildZeroPowerProducers();
				this.setMessage(
					[
						...new Set([this.recoveryMessage, this.lastAction].filter(Boolean)),
					].join("\n"),
				);
				this.updatePlan(
					"Recovering resource production. Science-funded research and zero-power producers continue; other powered purchases are paused.",
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
			this.buyBatteries();
			this.buildProducers("science");
			this.buildZeroPowerProducers();
			const powered =
				Game.resources.getResource("energy") > this.powerWanted &&
				!window.energyLow &&
				!window.globalEnergyLock &&
				this.energySecondsAfterConsumption(0) >= this.minimumEnergyRunway;
			for (const resource of Object.keys(this.producers)) {
				if (
					["energy", "plasma", "meteorite", "science", "rocketFuel"].includes(
						resource,
					)
				)
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
			this.enabled = false;
			this.autoEmcEnabled = false;
			this.updateAutoEmcControl();
			this.updateEnabledControl();
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
			(resource === "rocketFuel" && !window.rocketFuelToggled) ||
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
		if (
			this.interstellarSavings &&
			!this.hasResources(this.producerCost(resource, producer))
		)
			return { kind: this.status.UNAFFORDABLE, producer };
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

	producerCost(resource, producer) {
		const producers =
			resource === "batteries"
				? this.batteryProducers
				: this.producers[resource];
		const tierOne =
			producers.at(-1) === producer &&
			!["science", "rocketFuel"].includes(resource);
		const discount = tierOne ? window.T1Price : 1;
		return Object.fromEntries(
			[...new Set(Object.values(RESOURCE))].flatMap((input) => {
				const amount =
					window[`${producer}${input[0].toUpperCase()}${input.slice(1)}Cost`];
				return amount === undefined ? [] : [[input, amount * discount]];
			}),
		);
	},

	weightedProducerCost(resource, producer) {
		const cost = this.producerCost(resource, producer);
		if (Object.keys(cost).length === 0) return null;
		return Object.entries(cost).reduce(
			(total, [input, amount]) =>
				total + amount * (input === "meteorite" ? 10 : 1),
			0,
		);
	},

	numberIfy(value, digits) {
		//! Converts a value to a number with the specified number of digits. Returns null if the value is not a finite number, also adds commas to numbers
		const number = Number(value);
		return Number.isFinite(number)
			? Number(number.toFixed(digits)).toLocaleString()
			: null;
	},

	shouldSaveForHigherTier(
		resource,
		producer,
		producers = this.producers[resource],
	) {
		if (resource === "science") return false;
		const higher = producers
			.slice(0, producers.indexOf(producer))
			.reverse()
			.find((candidate) =>
				this.isActionAvailable(
					`get${candidate[0].toUpperCase()}${candidate.slice(1)}`,
				),
			);
		if (!higher) return false;
		const price = this.weightedProducerCost(resource, producer);
		const higherPrice = this.weightedProducerCost(resource, higher);
		if (price === null || higherPrice === null || price <= higherPrice * 0.5)
			return false;
		this.buildingPlans.set(
			resource,
			`Saving for ${higher}: ${producer} costs ${this.numberIfy(price)} weighted items, above half of ${this.numberIfy(higherPrice)}. ${this.affordabilityCountdown(this.producerCost(resource, higher))}`,
		);
		return true;
	},

	buildZeroPowerProducers() {
		for (const resource of Object.keys(this.producers)) {
			if (["energy", "plasma", "meteorite", "rocketFuel"].includes(resource))
				continue;
			this.buildProducers(resource, true);
		}
	},

	buildProducers(resource, zeroPowerOnly = false, productionNeeded = false) {
		if (!productionNeeded && this.maxedOut(resource)) return;
		const producers = this.producers[resource];
		for (const producer of producers) {
			if (
				!this.isActionAvailable(
					`get${producer[0].toUpperCase()}${producer.slice(1)}`,
				)
			)
				continue;
			if (zeroPowerOnly && (this.producerInputs(producer).energy ?? 0) > 0)
				continue;
			if (!zeroPowerOnly && this.shouldSaveForHigherTier(resource, producer))
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
		this.interstellarSavings = null;
		const summary = deficits
			.map(
				(resource) => `${resource}: ${this.numberIfy(this.budget[resource])}/s`,
			)
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
							? `${reason.producer} would leave ${this.numberIfy(reason.secondsRemaining / 3600)}h of energy; needs at least ${reason.requiredSeconds / 3600}h`
							: `${reason.producer} needs ${this.numberIfy(reason.required)} ${reason.input}/s, available ${this.numberIfy(reason.available)}/s`;
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
			this.lastAction = `Saving for ${selected.producer} to ${purpose}. ${this.affordabilityCountdown(selected.cost)}`;
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
				this.shouldSaveForHigherTier("meteorite", producer) ||
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

	hasResources(cost, useSavings = true) {
		return Object.entries(cost).every(
			([resource, amount]) =>
				Number.isFinite(amount) &&
				Game.resources.getResource(resource) >=
					amount +
						(useSavings ? (this.interstellarSavings?.[resource] ?? 0) : 0),
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

	buyBatteries() {
		const t4Complete = Game.tech.getTechData("unlockLabT4")?.current > 0;
		const unlocked = this.batteryProducers.filter((producer) => {
			if (producer !== "battery" && !t4Complete) return false;
			const research =
				producer === "battery"
					? "unlockBatteries"
					: `unlockBatteries${producer.slice(7)}`;
			return (
				(producer === "batteryT5" ||
					Game.tech.getTechData(research)?.current > 0) &&
				this.isActionAvailable(
					`get${producer[0].toUpperCase()}${producer.slice(1)}`,
				)
			);
		});
		for (const producer of unlocked) {
			if (
				this.shouldSaveForHigherTier("batteries", producer, unlocked) ||
				!this.hasResources(this.producerCost("batteries", producer))
			)
				continue;
			this.recordResult(
				this.tryBuildProducer("batteries", producer),
				`Built ${producer}`,
			);
		}
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
			"unlockBatteries",
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
		if (this.interstellarSavings) return;
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

	emcResources() {
		return Object.keys(this.producers).filter(
			(resource) =>
				!["energy", "plasma", "meteorite", "science", "rocketFuel"].includes(
					resource,
				),
		);
	},

	updateRunner() {
		if (this.enabled || this.autoEmcEnabled) monkeyrunner.start();
		else monkeyrunner.cancel();
	},

	setAutoEmc(enabled, resource = this.autoEmcResource) {
		if (!this.emcResources().includes(resource)) return;
		this.autoEmcEnabled = enabled;
		this.autoEmcResource = resource;
		this.updateAutoEmcControl();
		this.updateRunner();
	},

	updateAutoEmcControl() {
		const toggle = document.getElementById("automonkeyEmcEnabled");
		const select = document.getElementById("automonkeyEmcResource");
		if (toggle) toggle.checked = this.autoEmcEnabled;
		if (select) select.value = this.autoEmcResource;
		this.setEmcMessage(
			this.autoEmcEnabled
				? `Auto EMC: ${this.autoEmcResource}.`
				: "Auto EMC is off.",
		);
	},

	setEmcMessage(message) {
		const status = document.getElementById("automonkeyEmcMessage");
		if (status) status.textContent = message;
	},

	runAutoEmc() {
		if (!this.autoEmcEnabled) return;
		try {
			if (
				Number.isFinite(Game.lastFixedUpdate) &&
				Date.now() - Game.lastFixedUpdate > 2000
			) {
				this.setEmcMessage("Auto EMC: waiting for fresh production data.");
				return;
			}
			const resource = this.autoEmcResource;
			if (
				!Game.tech.getTechData("unlockEmc")?.current ||
				!this.isResourceAvailable(resource) ||
				typeof window.convertEnergy !== "function"
			) {
				this.setEmcMessage(
					"Auto EMC: waiting for EMC research and resource unlock.",
				);
				return;
			}
			if (window.energyLow || window.globalEnergyLock) {
				this.setEmcMessage("Auto EMC: energy production is disabled or low.");
				return;
			}
			if (!this.enabled || !this.budget) this.beginTick();
			const current = Game.resources.getResource(resource);
			const capacity = Game.resources.getStorage(resource);
			const price = window[`${resource}EmcVal`];
			const reserve = Math.max(
				0,
				-this.budget.energy * this.minimumEnergyRunway,
			);
			const available = Math.max(
				0,
				Game.resources.getResource("energy") - reserve,
			);
			const amount = Math.floor(
				Math.min(
					available / price,
					capacity < 0 ? Infinity : capacity - current,
				),
			);
			if (!(price > 0) || !Number.isFinite(amount) || amount <= 0) {
				this.setEmcMessage(
					capacity >= 0 && current >= capacity
						? "Auto EMC: resource storage is full."
						: "Auto EMC: waiting for spare energy.",
				);
				return;
			}
			const previousAmount = window.emcAmount;
			try {
				window.emcAmount = amount;
				convertEnergy(resource, false);
			} finally {
				window.emcAmount = previousAmount;
				if (typeof window.refreshConversionDisplay === "function")
					refreshConversionDisplay();
			}
			const gained = Game.resources.getResource(resource) - current;
			this.setEmcMessage(
				gained > 0
					? `Auto EMC: bought ${this.numberIfy(gained)} ${resource}.`
					: "Auto EMC: conversion did not complete.",
			);
		} catch (error) {
			this.autoEmcEnabled = false;
			this.updateAutoEmcControl();
			this.updateRunner();
			console.error("Auto EMC stopped", error);
			this.setEmcMessage(`Auto EMC stopped: ${String(error)}`);
		}
	},

	convertResource(resource) {
		if (!Game.tech.getTechData("unlockEmc")?.current) return;
		if (resource === "meteorite") {
			if (Game.tech.getTechData("unlockMeteorite")?.current)
				convertPlasma(resource);
		} else if (this.isResourceAvailable(resource)) convertEnergy(resource);
	},

	exploreSolarSystem(allowFuelProduction = true) {
		if (!Game.tech.getTechData("unlockSolarSystem")?.current) {
			this.explorationPlan =
				"Waiting for Space research to unlock solar-system exploration.";
			return;
		}
		const waitForFuel = (fuel, purpose) => {
			this.explorationPlan =
				`${purpose}\n${this.affordabilityCountdown({ rocketFuel: fuel })}`.trim();
			if (window.rocketFuelToggled === false) {
				this.explorationPlan += "\nRocket fuel production is disabled.";
				return;
			}
			if (allowFuelProduction) this.buildProducers("rocketFuel", false, true);
			else
				this.explorationPlan +=
					"\nAdditional fuel producers wait for production recovery.";
		};
		if (!window.rocketLaunched) {
			if (!(window.rocket >= 1)) {
				const cost = { metal: 1200, gem: 900, oil: 1000 };
				this.explorationPlan =
					`Building the first solar-system rocket.\n${this.affordabilityCountdown(cost)}`.trim();
				if (!this.isActionAvailable("getRocket") || !this.hasResources(cost))
					return;
				getRocket();
				if (!(window.rocket >= 1)) return;
				this.recordResult(
					{ kind: this.status.SUCCESS },
					"Built solar-system rocket",
				);
			}
			if (!this.isActionAvailable("launchRocket")) return;
			if (!this.hasResources({ rocketFuel: 20 })) {
				waitForFuel(
					20,
					"Waiting for 20 rocket fuel to launch the solar-system rocket.",
				);
				return;
			}
			launchRocket();
			if (!window.rocketLaunched) return;
			this.recordResult(
				{ kind: this.status.SUCCESS },
				"Launched solar-system rocket",
			);
		}
		const destinations = [
			["Moon", 20],
			["Venus", 50],
			["Mars", 80],
			["AsteroidBelt", 200],
			["WonderStation", 500],
			["Jupiter", 1000],
			["Saturn", 2000],
			["Pluto", 5000],
			["KuiperBelt", 6000],
			["SolCenter", 7000],
		];
		const completed = (name) =>
			window.buttonsHidden?.includes(`explore${name}`) ||
			window.explored?.includes(name[0].toLowerCase() + name.slice(1));
		for (const [name, fuel] of destinations) {
			if (completed(name)) continue;
			const navigation = document.getElementById(
				name[0].toLowerCase() + name.slice(1),
			);
			const action = document.getElementById(`explore${name}`);
			if (
				typeof window.explore !== "function" ||
				!this.isElementAvailable(navigation) ||
				!this.isElementAvailable(action)
			)
				continue;
			const label = name.replace(/([a-z])([A-Z])/g, "$1 $2");
			if (!this.hasResources({ rocketFuel: fuel })) {
				waitForFuel(
					fuel,
					`Waiting to explore ${label}: ${fuel.toFixed(0)} rocket fuel.`,
				);
				return;
			}
			explore(name);
			if (!completed(name)) {
				this.explorationPlan = `Exploration of ${label} did not complete; retrying next tick.`;
				return;
			}
			this.recordResult({ kind: this.status.SUCCESS }, `Explored ${label}`);
		}
		this.explorationPlan = destinations.every(([name]) => completed(name))
			? "Solar-system exploration complete."
			: "Waiting for the next solar-system destination to unlock.";
	},

	syncStargateUnlocks() {
		if (!window.buttonsHidden?.includes("rebuildStargate")) return;
		// Native Stargate completion references a nonexistent entry instead of its travel and military unlocks.
		for (const id of ["travel", "military"]) {
			const entry = Game.interstellar.getInterstellarData?.(id);
			if (entry && !entry.unlocked) {
				entry.unlocked = true;
				entry.displayNeedsUpdate = true;
			}
		}
	},

	workInterstellar() {
		if (!(window.sphere > 0)) return;
		const interstellar = Game.interstellar;
		this.syncStargateUnlocks();
		const scout = interstellar.military?.getShipData("scout");
		const drive = interstellar.antimatter?.getMachineData("drive");
		const breakthrough =
			interstellar.comms?.getMachineData("astroBreakthrough");
		if (!scout || !drive || !breakthrough) return;
		if (breakthrough.count >= 1 && scout.count >= 1 && drive.count >= 1) {
			this.interstellarPlan =
				"Interstellar flight ready: scout, Alcubierre drive and Astronomical Breakthrough complete.";
			return;
		}
		if (!interstellar.rocket?.getRocketData("tier1Rocket")?.built) {
			this.interstellarPlan =
				"Working towards interstellar flight: complete the rocket and its wonder unlocks.";
			return;
		}
		const [category, entry, id] =
			scout.count < 1
				? ["military", scout, "scout"]
				: drive.count < 1
					? ["antimatter", drive, "drive"]
					: ["comms", breakthrough, "astroBreakthrough"];
		this.interstellarPlan = `Working towards ${entry.name}.`;
		if (
			!entry.unlocked ||
			!interstellar.getInterstellarData(category)?.unlocked ||
			!this.isElementAvailable(document.getElementById(`${entry.htmlId}_buy`))
		) {
			this.interstellarPlan += " Waiting for the interstellar wonder unlock.";
			return;
		}
		const module = interstellar[category];
		module.updateCost(id);
		if (id === "astroBreakthrough")
			this.interstellarSavings = { ...entry.cost };
		this.interstellarPlan += ` ${this.affordabilityCountdown(entry.cost)}`;
		if (id === "drive") {
			if (Object.values(this.budget).some((rate) => rate < 0)) {
				this.interstellarPlan +=
					"\nWaiting for production recovery before adding an Alcubierre drive.";
				return;
			}
			if (window.antimatterToggled === false) {
				this.interstellarPlan += "\nAntimatter production is disabled.";
				return;
			}
			for (const [resource, rate] of Object.entries(entry.resourcePerSecond)) {
				if (rate >= 0) continue;
				const required = -rate + (resource === "plasma" ? 1 : 0);
				if (this.budget[resource] >= required) continue;
				this.interstellarPlan += `\nWaiting for ${this.numberIfy(required)} ${resource}/s spare capacity.`;
				if (resource === "plasma")
					this.buildPlasmaSupply(
						"supply the Alcubierre drive and keep 1 plasma/s spare",
					);
				else this.buildProducers(resource, false, true);
				return;
			}
		}
		this.interstellarSavings = { ...entry.cost };
		if (!this.hasResources(entry.cost, false)) return;
		const before = entry.count;
		if (category === "military") module.buildShip(id);
		else module.buildMachine(id);
		if (entry.count <= before) {
			this.interstellarPlan +=
				"\nPurchase did not complete; retrying next tick.";
			return;
		}
		if (id === "drive") {
			for (const [resource, rate] of Object.entries(entry.resourcePerSecond))
				if (rate < 0) this.budget[resource] += rate;
		}
		this.interstellarSavings = null;
		this.recordResult({ kind: this.status.SUCCESS }, `Built ${entry.name}`);
		this.workInterstellar();
	},

	buyRocket() {
		const rockets = Game.interstellar.rocket;
		const parts = Game.interstellar.rocketParts;
		const rocket = rockets?.getRocketData("tier1Rocket");
		if (
			!rocket?.unlocked ||
			rocket.built ||
			!parts ||
			!Game.interstellar.getInterstellarData("rocket")?.unlocked ||
			!this.isElementAvailable(document.getElementById(`${rocket.htmlId}_buy`))
		)
			return;
		const missing = [];
		for (const [id, required] of Object.entries(rocket.cost)) {
			const part = parts.getPartData(id);
			if (!part?.unlocked) {
				missing.push(`${part?.name ?? id}: waiting for unlock.`);
				continue;
			}
			const target = Math.min(required, part.max);
			if (
				part.count < target &&
				this.isElementAvailable(document.getElementById(`${part.htmlId}_buy`))
			) {
				parts.updateCost(id);
				while (part.count < target && this.hasResources(part.cost)) {
					const before = part.count;
					parts.buildPart(id, 1);
					if (part.count <= before) break;
					this.recordResult(
						{ kind: this.status.SUCCESS },
						`Built ${part.name}: ${this.numberIfy(part.count)}/${this.numberIfy(required)}`,
					);
				}
			}
			if (part.count < required)
				missing.push(
					`${part.name}: ${this.numberIfy(part.count)}/${this.numberIfy(required)}. ${this.affordabilityCountdown(part.cost)}`,
				);
		}
		if (
			Object.entries(rocket.cost).every(
				([id, required]) => parts.getPartData(id)?.count >= required,
			)
		) {
			rockets.buildRocket("tier1Rocket");
			if (rocket.built)
				this.recordResult(
					{ kind: this.status.SUCCESS },
					`Built ${rocket.name}`,
				);
			else
				this.rocketPlan = `Rocket parts ready; waiting for ${rocket.name} assembly.`;
		} else {
			this.rocketPlan = `Building parts for ${rocket.name}.\n${missing.join("\n")}`;
		}
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
			try {
				window[func]();
			} catch (error) {
				if (
					func !== "rebuildStargate" ||
					!(error instanceof TypeError) ||
					!window.buttonsHidden?.includes(completed) ||
					Game.interstellar.getInterstellarData?.("stargate") ||
					!Game.interstellar.getInterstellarData?.("travel") ||
					!Game.interstellar.getInterstellarData?.("military")
				)
					throw error;
			}
			this.syncStargateUnlocks();
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
		if (!panel.querySelector("#automonkeyEnabled")) {
			const control = document.createElement("p");
			const label = document.createElement("label");
			const toggle = document.createElement("input");
			toggle.id = "automonkeyEnabled";
			toggle.type = "checkbox";
			label.htmlFor = toggle.id;
			label.appendChild(toggle);
			label.appendChild(document.createTextNode(" Automation enabled"));
			control.appendChild(label);
			panel.appendChild(control);
		}
		const toggle = panel.querySelector("#automonkeyEnabled");
		panel.prepend(toggle.closest("p"));
		toggle.onchange = () => this.setEnabled(toggle.checked);
		this.updateEnabledControl();
		if (!panel.querySelector("#automonkeyEmcEnabled")) {
			const control = document.createElement("p");
			const label = document.createElement("label");
			const checkbox = document.createElement("input");
			checkbox.id = "automonkeyEmcEnabled";
			checkbox.type = "checkbox";
			label.htmlFor = checkbox.id;
			label.appendChild(checkbox);
			label.appendChild(document.createTextNode(" Auto EMC "));
			const select = document.createElement("select");
			select.id = "automonkeyEmcResource";
			select.setAttribute("aria-label", "Auto EMC resource");
			for (const resource of this.emcResources()) {
				const option = document.createElement("option");
				option.value = resource;
				option.textContent =
					resource === "gem"
						? "Gems"
						: resource[0].toUpperCase() + resource.slice(1);
				select.appendChild(option);
			}
			const status = document.createElement("span");
			status.id = "automonkeyEmcMessage";
			status.style.display = "block";
			control.appendChild(label);
			control.appendChild(select);
			control.appendChild(status);
			toggle.closest("p").after(control);
		}
		const emcToggle = panel.querySelector("#automonkeyEmcEnabled");
		const emcSelect = panel.querySelector("#automonkeyEmcResource");
		emcToggle.onchange = () =>
			this.setAutoEmc(emcToggle.checked, emcSelect.value);
		emcSelect.onchange = () =>
			this.setAutoEmc(emcToggle.checked, emcSelect.value);
		this.updateAutoEmcControl();
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
			tabList.appendChild(tab);
		}
	},

	setMessage(text) {
		const message = document.getElementById("automonkeyMessage");
		if (message) {
			message.textContent = text;
		}
	},

	setEnabled(enabled) {
		this.enabled = enabled;
		this.updateRunner();
		this.updateEnabledControl();
		this.setMessage(
			enabled
				? "Automation enabled; resuming on the next tick."
				: "Automation is off.",
		);
		this.updatePlan();
	},

	updateEnabledControl() {
		const toggle = document.getElementById("automonkeyEnabled");
		if (toggle) toggle.checked = this.enabled;
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
		if (seconds === 0) return "";
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
				? `Waiting for ${name}: ${this.numberIfy(Game.resources.getResource("science"))} / ${this.numberIfy(this.researchCost(id).science)} science. ${this.affordabilityCountdown(this.researchCost(id))}`
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
			return `${waiting("unlockLabT4", "T4 science")}\nT1 batteries are allowed. Higher battery tiers, PSUs and efficiency upgrades wait until T4 is complete.`;
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
		return `Focusing on science and energy efficiency${energy ? ` (energy ${this.numberIfy(energy.current)} / ${this.numberIfy(energy.maxLevel)})` : ""}.\nResource efficiency is allowed only when its next upgrade costs less than 10% of both.\nBuy the cheaper priority upgrade first.`;
	},

	updatePlan(prefix = "") {
		const plan = document.getElementById("automonkeyPlan");
		if (plan) {
			if (!this.enabled) {
				plan.textContent =
					"Automation is off. Enable it to resume purchases and research.";
				return;
			}
			const seconds = this.energySecondsAfterConsumption(0);
			const powerPlan = Number.isFinite(seconds)
				? `Energy runway: ${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m.\nNew powered buildings must leave at least ${this.minimumEnergyRunway / 3600}h.`
				: `Powered buildings may use energy reserves if at least ${this.minimumEnergyRunway / 3600}h remain after purchase.`;
			plan.textContent = [
				prefix.trim() ||
					"Building affordable resource, power and science producers as inputs allow.",
				this.sciencePlan(),
				this.plasmaPlan,
				this.rocketPlan,
				this.explorationPlan,
				this.interstellarPlan,
				...(this.buildingPlans?.values() ?? []),
				powerPlan,
			]
				.map((message) => message?.trim())
				.filter(Boolean)
				.join("\n");
		}
	},
};

console.debug(monkeyrunner.setup(automonkey));
