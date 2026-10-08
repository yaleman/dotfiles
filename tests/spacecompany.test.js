const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
	path.join(__dirname, "../spacecompany.js"),
	"utf8",
);
const resourceIds = [
	"energy",
	"plasma",
	"uranium",
	"lava",
	"oil",
	"metal",
	"gem",
	"charcoal",
	"wood",
	"silicon",
	"lunarite",
	"methane",
	"titanium",
	"gold",
	"silver",
	"hydrogen",
	"helium",
	"ice",
	"meteorite",
	"science",
	"rocketFuel",
];

function harness({
	rates = {},
	stock = {},
	machines = [],
	technologies = {},
	actions = {},
	globals = {},
	storage = {},
	localStorage = { getItem: () => null, setItem() {} },
} = {}) {
	const messages = [];
	const purchases = [];
	const gathering = [];
	const canceled = [];
	const available = new Map();
	const context = vm.createContext({
		RESOURCE: Object.fromEntries(resourceIds.map((id) => [id, id])),
		localStorage,
		Game: {
			resources: {
				getProduction: (id) => rates[id] ?? 0,
				getResource: (id) => stock[id] ?? 0,
				getStorage: (id) => storage[id] ?? (id === "science" ? -1 : 100000),
				getResourceData: () => ({ unlocked: true }),
			},
			tech: { getTechData: (id) => technologies[id] },
			interstellar: { stars: { systemsConquered: 0 } },
		},
		document: {
			getElementById: (id) =>
				id.endsWith("Nav")
					? {
							classList: { contains: () => false },
							style: {},
							parentElement: null,
						}
					: null,
			querySelectorAll: (selector) => {
				const action = [...available.keys()].find(
					(name) => selector === `button[onclick="${name}()"]`,
				);
				return action
					? [
							{
								classList: { contains: () => available.get(action) === false },
								style: {},
								parentElement: null,
							},
						]
					: [];
			},
		},
		console: { debug() {}, error() {} },
		setInterval: () => 1,
		clearInterval: (id) => canceled.push(id),
		gainResource: (id) => {
			gathering.push(id);
			stock[id] = (stock[id] ?? 0) + 1;
		},
		ring: 0,
		swarm: 0,
		sphere: 0,
		dyson: 0,
		heater: 0,
		T1Price: 1,
		ringSegmentCost: 50,
		swarmSegmentCost: 100,
		sphereSegmentCost: 250,
		ringRocketFuelCost: 5,
		swarmRocketFuelCost: 10,
		sphereRocketFuelCost: 25,
		charcoalToggled: true,
		meteoriteToggled: true,
		heaterToggled: true,
		plasmaticToggled: true,
		bathToggled: true,
		...globals,
	});
	context.window = context;
	context.getCost = (base, level) => Math.floor(base * 1.1 ** level);
	technologies.energyEfficiencyResearch ??= {
		unlocked: true,
		current: 0,
		maxLevel: 25,
		cost: { science: 10000000 },
	};
	context.purchaseTech = (id) => {
		const tech = technologies[id];
		const costs = Object.fromEntries(
			Object.entries(tech.cost).map(([resource, cost]) => [
				resource,
				context.getCost(cost, tech.current),
			]),
		);
		if (
			Object.entries(costs).some(
				([resource, cost]) => (stock[resource] ?? 0) < cost,
			)
		)
			return;
		for (const [resource, cost] of Object.entries(costs))
			stock[resource] -= cost;
		tech.current++;
		for (const next of tech.newTechs ?? []) technologies[next].unlocked = true;
		purchases.push(id);
	};
	for (const machine of machines) {
		context[machine.name] = machine.count ?? 0;
		for (const [resource, amount] of Object.entries(machine.inputs ?? {}))
			context[
				`${machine.name}${resource[0].toUpperCase()}${resource.slice(1)}Input`
			] = amount;
		const func = `get${machine.name[0].toUpperCase()}${machine.name.slice(1)}`;
		available.set(func, !machine.locked);
		context[func] = () => {
			if (machine.error) throw new Error(machine.error);
			if (machine.affordable === false) return;
			context[machine.name]++;
			purchases.push(machine.name);
		};
	}
	for (const [name, action] of Object.entries(actions)) {
		available.set(name, true);
		context[name] = action;
	}
	vm.runInContext(source, context);
	context.automonkey.setMessage = (message) => messages.push(message);
	context.automonkey.beginTick();
	return {
		context,
		monkey: context.automonkey,
		rates,
		stock,
		purchases,
		gathering,
		messages,
		canceled,
		technologies,
		available,
	};
}

function purchasedTech(extra = {}) {
	return { unlocked: true, current: 1, maxLevel: 1, cost: {}, ...extra };
}

function research(science, extra = {}) {
	return {
		unlocked: true,
		current: 0,
		maxLevel: 1,
		cost: { science },
		...extra,
	};
}

test("energy runway setting restores, saves and survives pasting the script again", () => {
	let saved = "8";
	const state = harness({
		localStorage: {
			getItem: (key) => {
				assert.equal(key, "automonkey.minimumEnergyRunwayHours");
				return saved;
			},
			setItem: (key, value) => {
				assert.equal(key, "automonkey.minimumEnergyRunwayHours");
				saved = value;
			},
		},
	});
	assert.equal(state.monkey.minimumEnergyRunway, 8 * 3600);
	assert.equal(state.monkey.setEnergyRunwayHours(2), true);
	assert.equal(saved, "2");
	vm.runInContext(source, state.context);
	assert.equal(state.context.automonkey.minimumEnergyRunway, 2 * 3600);
});

test("invalid saved settings retain the four-hour default", () => {
	for (const value of [null, "", "NaN", "0", "25", "4.5", "Infinity"]) {
		const state = harness({
			localStorage: { getItem: () => value, setItem() {} },
		});
		assert.equal(state.monkey.minimumEnergyRunway, 4 * 3600);
	}
});

test("changing runway updates the control, plan and purchase policy immediately", () => {
	const state = harness({
		rates: { energy: 0 },
		stock: { energy: 72000 },
		machines: [{ name: "laserCutter", inputs: { energy: 10 } }],
	});
	const slider = { value: "" },
		value = { textContent: "" },
		plan = { textContent: "" };
	state.context.document.getElementById = (id) =>
		({
			automonkeyEnergyRunway: slider,
			automonkeyEnergyRunwayValue: value,
			automonkeyPlan: plan,
		})[id] ?? null;
	assert.equal(
		state.monkey.tryBuildProducer("wood", "laserCutter").kind,
		state.monkey.status.INPUTS,
	);
	state.monkey.setEnergyRunwayHours(2);
	assert.equal(slider.value, "2");
	assert.equal(value.textContent, "2 hours");
	assert.match(plan.textContent, /at least 2h/);
	assert.equal(
		state.monkey.tryBuildProducer("wood", "laserCutter").kind,
		state.monkey.status.SUCCESS,
	);
	assert.equal(state.monkey.setEnergyRunwayHours(0), false);
	assert.equal(state.monkey.minimumEnergyRunway, 7200);
});

test("unavailable localStorage does not stop automation or discard the active setting", () => {
	const state = harness({
		localStorage: {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			},
		},
	});
	assert.equal(state.monkey.minimumEnergyRunway, 14400);
	assert.equal(state.monkey.setEnergyRunwayHours(1), true);
	assert.equal(state.monkey.minimumEnergyRunway, 3600);
	assert.match(state.messages.at(-1), /could not save/);
	assert.deepEqual(state.canceled, []);
});

test("energy helpers report current depletion and a hypothetical absolute deficit", () => {
	const state = harness({ rates: { energy: -10 }, stock: { energy: 144000 } });
	assert.equal(state.monkey.energySecondsRemaining(), 14400);
	assert.equal(state.monkey.energySecondsAtDeficit(20), 7200);
	assert.equal(state.monkey.energySecondsAtDeficit(-20), 7200);
	assert.equal(state.monkey.energySecondsAtDeficit(0), Infinity);
	assert.equal(state.monkey.energySecondsRemaining(5), Infinity);
	assert.equal(state.monkey.energySecondsAfterConsumption(10), 7200);
	state.stock.energy = 0;
	assert.equal(state.monkey.energySecondsRemaining(), 0);
});

for (const [stock, expected] of [
	[143999, "INPUTS"],
	[144000, "SUCCESS"],
	[144001, "SUCCESS"],
]) {
	test(`powered purchases at reserve ${stock} obey the four-hour boundary`, () => {
		const state = harness({
			rates: { energy: 5 },
			stock: { energy: stock },
			machines: [{ name: "laserCutter", inputs: { energy: 15 } }],
		});
		assert.equal(
			state.monkey.tryBuildProducer("wood", "laserCutter").kind,
			state.monkey.status[expected],
		);
	});
}

test("energy reserve allowance uses cumulative discounted consumption and live stock", () => {
	const state = harness({
		rates: { energy: 5 },
		stock: { energy: 144000 },
		technologies: { energyEfficiencyResearch: purchasedTech({ current: 50 }) },
		machines: [
			{ name: "laserCutter", inputs: { energy: 30 } },
			{ name: "scorcher", inputs: { energy: 10 } },
		],
	});
	assert.equal(
		state.monkey.tryBuildProducer("wood", "laserCutter").kind,
		state.monkey.status.SUCCESS,
	);
	assert.equal(state.monkey.budget.energy, -10);
	assert.equal(state.monkey.energySecondsAfterConsumption(5), 9600);
	assert.equal(
		state.monkey.tryBuildProducer("silicon", "scorcher").kind,
		state.monkey.status.INPUTS,
	);
	state.stock.energy = 216000;
	assert.equal(
		state.monkey.tryBuildProducer("silicon", "scorcher").kind,
		state.monkey.status.SUCCESS,
	);
});

test("safe energy deficits permit normal useful building, unsafe deficits prioritize recovery", () => {
	for (const [stock, labExpected] of [
		[288000, true],
		[14399, false],
	]) {
		const state = harness({
			rates: { energy: -1, wood: 10, plasma: 1 },
			stock: { energy: stock },
			machines: [
				{ name: "solarPanel" },
				{ name: "lab", inputs: { energy: 10 } },
			],
		});
		state.monkey.run();
		assert.deepEqual(
			state.purchases,
			labExpected ? ["solarPanel", "lab"] : ["solarPanel"],
		);
	}
});

test("energy reserves do not relax non-energy budgets, toggles or plasma reserves", () => {
	const state = harness({
		rates: { energy: 0, wood: 1 },
		stock: { energy: 100000000 },
		machines: [{ name: "furnace", inputs: { energy: 10, wood: 2 } }],
	});
	assert.equal(
		state.monkey.tryBuildProducer("charcoal", "furnace").kind,
		state.monkey.status.INPUTS,
	);
	state.monkey.budget.wood = 2;
	state.context.charcoalToggled = false;
	assert.equal(
		state.monkey.tryBuildProducer("charcoal", "furnace").kind,
		state.monkey.status.DISABLED,
	);
});

test("plan shows projected energy runway and the reserve policy", () => {
	const state = harness({ rates: { energy: -10 }, stock: { energy: 180000 } });
	const plan = { textContent: "" };
	state.context.document.getElementById = (id) =>
		id === "automonkeyPlan" ? plan : null;
	state.monkey.updatePlan();
	assert.match(plan.textContent, /Energy runway: 5h 0m/);
	assert.match(plan.textContent, /at least 4h/);
});

test("research countdown tracks changing stock, generation and growing costs", () => {
	const state = harness({
		stock: { science: 100 },
		rates: { science: 10 },
		technologies: { unlockLabT4: research(36100) },
	});
	assert.match(state.monkey.sciencePlan(), /Estimated ready in 1h 00m 00s/);
	state.stock.science += 10;
	assert.match(state.monkey.sciencePlan(), /0h 59m 59s/);
	state.rates.science = 20;
	assert.match(state.monkey.sciencePlan(), /0h 30m 00s/);
	state.stock.science = 0;
	assert.match(state.monkey.sciencePlan(), /0h 30m 05s/);
	assert.equal(state.monkey.secondsUntilAffordable({ science: 200 }), 10);
});

test("countdown uses the slowest required resource, ignoring already affordable inputs", () => {
	const state = harness({
		stock: { science: 10, metal: 1, wood: 100 },
		rates: { science: 5, metal: 1 },
	});
	assert.equal(
		state.monkey.secondsUntilAffordable({ science: 20, metal: 10, wood: 10 }),
		9,
	);
	assert.match(
		state.monkey.affordabilityCountdown({ science: 10 }),
		/Resources ready/,
	);
	assert.match(
		state.monkey.affordabilityCountdown({ science: 10.1 }),
		/0h 00m 01s/,
	);
});

test("countdown explains stalled production and omits estimates for locked research", () => {
	const state = harness({ technologies: { unlockLabT4: research(100) } });
	for (const rate of [0, -1]) {
		state.rates.science = rate;
		assert.equal(
			state.monkey.secondsUntilAffordable({ science: 100 }),
			Infinity,
		);
		assert.match(
			state.monkey.sciencePlan(),
			/required resource is not increasing/,
		);
	}
	state.technologies.unlockLabT4.unlocked = false;
	assert.doesNotMatch(
		state.monkey.sciencePlan(),
		/Estimated ready|No countdown/,
	);
});

test("meteorite and storage waits include their own countdowns", () => {
	const state = harness({
		rates: { science: 10 },
		technologies: {
			unlockLabT4: purchasedTech(),
			unlockMeteorite: research(100, { name: "Meteorite" }),
			unlockPSU: research(600, { name: "Plasma Storage Units" }),
		},
	});
	assert.match(
		state.monkey.sciencePlan(),
		/Waiting for Meteorite.*\n.*0h 00m 10s/,
	);
	state.technologies.unlockMeteorite.current = 1;
	assert.match(
		state.monkey.sciencePlan(),
		/Waiting for Plasma Storage Units.*\n.*0h 01m 00s/,
	);
});

test("plan explains T4 waiting with whole-number science costs", () => {
	const state = harness({
		stock: { science: 12.4 },
		technologies: { unlockLabT4: research(50000000) },
	});
	assert.match(
		state.monkey.sciencePlan(),
		/Waiting for T4 science: 12 \/ 50000000 science/,
	);
	assert.match(
		state.monkey.sciencePlan(),
		/Batteries, PSUs and efficiency upgrades wait/,
	);
	state.technologies.unlockLabT4.unlocked = false;
	assert.match(state.monkey.sciencePlan(), /T4 science to become available/);
});

test("plan follows meteorite, storage and efficiency research stages", () => {
	const state = harness({
		technologies: {
			unlockLabT4: purchasedTech(),
			unlockMeteorite: research(100000, { name: "Meteorite" }),
			unlockPSU: research(9500000, { name: "Plasma Storage Units" }),
		},
	});
	assert.match(state.monkey.sciencePlan(), /Meteorite research takes priority/);
	state.technologies.unlockMeteorite.current = 1;
	assert.match(state.monkey.sciencePlan(), /Waiting for Plasma Storage Units/);
	state.technologies.unlockPSU.current = 1;
	assert.match(state.monkey.sciencePlan(), /less than 10% of both/);
	state.technologies.energyEfficiencyResearch.current = 25;
	assert.match(
		state.monkey.sciencePlan(),
		/Science and resource efficiency have equal priority/,
	);
});

test("plan updates separately from action messages and explains recovery pauses", () => {
	const state = harness({ rates: { energy: -1 } });
	const plan = { textContent: "old plan" };
	state.context.document.getElementById = (id) =>
		id === "automonkeyPlan" ? plan : null;
	state.monkey.run();
	assert.match(
		plan.textContent,
		/Research paused while recovering resource production/,
	);
	assert.match(plan.textContent, /Waiting for T4 science/);
	assert.ok(state.messages.length > 0);
	state.technologies.unlockLabT4 = purchasedTech();
	state.monkey.updatePlan();
	assert.match(plan.textContent, /Focusing on science and energy efficiency/);
	assert.doesNotMatch(plan.textContent, /Research paused/);
});

test("plan reports research paused after an unexpected tick error", () => {
	const state = harness();
	const plan = { textContent: "old plan" };
	state.context.document.getElementById = (id) =>
		id === "automonkeyPlan" ? plan : null;
	state.context.Game.resources.getProduction = () => {
		throw new Error("broken rates");
	};
	state.monkey.run();
	assert.equal(plan.textContent, "Automation stopped. Research is paused.");
});

test("meteorite research spends science before Dyson, including immediately after EMC", () => {
	const state = harness({
		stock: { science: 160 },
		technologies: {
			unlockEmc: research(60, { newTechs: ["unlockMeteorite"] }),
			unlockMeteorite: research(100, { unlocked: false }),
			unlockDyson: research(100),
		},
	});
	state.monkey.unlockProgressionResearch();
	assert.deepEqual(state.purchases, ["unlockEmc", "unlockMeteorite"]);
	assert.equal(state.technologies.unlockDyson.current, 0);
});

test("available meteorite science takes priority without purchased Dyson research", () => {
	const state = harness({
		stock: { science: 100 },
		technologies: { unlockMeteorite: research(100), unlockEmc: research(60) },
	});
	state.monkey.unlockProgressionResearch();
	assert.deepEqual(state.purchases, ["unlockMeteorite"]);
});

test("battery and PSU research wait for T4 and unlock complete chains afterward", () => {
	const technologies = { unlockLabT4: research(100) };
	for (const chain of [
		["unlockPSU", "unlockPSUT2"],
		[
			"unlockBatteries",
			"unlockBatteriesT2",
			"unlockBatteriesT3",
			"unlockBatteriesT4",
		],
	]) {
		for (const [index, id] of chain.entries())
			technologies[id] = research(1, {
				unlocked: index === 0,
				newTechs: chain[index + 1] ? [chain[index + 1]] : [],
			});
	}
	technologies.scienceEfficiencyResearch = research(10, { maxLevel: -1 });
	const state = harness({ stock: { science: 99 }, technologies });
	state.monkey.buyEarlyScience();
	assert.deepEqual(state.purchases, []);
	state.stock.science = 106;
	state.monkey.buyEarlyScience();
	assert.deepEqual(state.purchases, [
		"unlockLabT4",
		"unlockPSU",
		"unlockPSUT2",
		"unlockBatteries",
		"unlockBatteriesT2",
		"unlockBatteriesT3",
		"unlockBatteriesT4",
	]);
});

test("research affordability uses the growing next-level cost", () => {
	const state = harness({
		stock: { science: 100 },
		technologies: {
			efficiencyResearch: research(100, { current: 2, maxLevel: -1 }),
		},
	});
	assert.equal(state.monkey.researchCost("efficiencyResearch").science, 121);
	assert.equal(
		state.monkey.tryBuyResearch("efficiencyResearch").kind,
		state.monkey.status.UNAFFORDABLE,
	);
	state.stock.science = 121;
	assert.equal(
		state.monkey.tryBuyResearch("efficiencyResearch").kind,
		state.monkey.status.SUCCESS,
	);
	assert.equal(state.stock.science, 0);
});

for (const [resourceCost, expected] of [
	[99, true],
	[100, false],
	[150, false],
]) {
	test(`resource efficiency at cost ${resourceCost} obeys the strict 10% threshold of both upgrades`, () => {
		const state = harness({
			stock: { science: 10000 },
			technologies: {
				unlockLabT4: purchasedTech(),
				scienceEfficiencyResearch: research(1000, { maxLevel: -1 }),
				energyEfficiencyResearch: research(2000, { maxLevel: 25 }),
				efficiencyResearch: research(resourceCost, { maxLevel: -1 }),
			},
		});
		state.monkey.buyEarlyScience();
		assert.deepEqual(state.purchases, [
			"scienceEfficiencyResearch",
			"energyEfficiencyResearch",
			...(expected ? ["efficiencyResearch"] : []),
		]);
	});
}

test("efficiency comparisons use current costs rather than cheap base prices", () => {
	const state = harness({
		stock: { science: 10000 },
		technologies: {
			unlockLabT4: purchasedTech(),
			scienceEfficiencyResearch: research(1000, { maxLevel: -1 }),
			energyEfficiencyResearch: research(1000, { maxLevel: 25 }),
			efficiencyResearch: research(50, { current: 10, maxLevel: -1 }),
		},
	});
	state.monkey.buyEarlyScience();
	assert.deepEqual(state.purchases, [
		"scienceEfficiencyResearch",
		"energyEfficiencyResearch",
	]);
});

for (const [scienceCost, resourceCost, expected] of [
	[1000, 500, "efficiencyResearch"],
	[500, 1000, "scienceEfficiencyResearch"],
]) {
	test(`capped energy gives science/resource equal priority, buying ${expected} first`, () => {
		const state = harness({
			stock: { science: 1000 },
			technologies: {
				unlockLabT4: purchasedTech(),
				scienceEfficiencyResearch: research(scienceCost, { maxLevel: -1 }),
				energyEfficiencyResearch: research(1, { current: 25, maxLevel: 25 }),
				efficiencyResearch: research(resourceCost, { maxLevel: -1 }),
			},
		});
		state.monkey.buyEarlyScience();
		assert.deepEqual(state.purchases, [expected]);
	});
}

test("reaching the energy cap removes the resource discount requirement immediately", () => {
	const state = harness({
		stock: { science: 20000 },
		technologies: {
			unlockLabT4: purchasedTech(),
			scienceEfficiencyResearch: research(1000, { maxLevel: -1 }),
			energyEfficiencyResearch: research(1000, { current: 24, maxLevel: 25 }),
			efficiencyResearch: research(1000, { maxLevel: -1 }),
		},
	});
	state.monkey.buyEarlyScience();
	assert.deepEqual(state.purchases, [
		"scienceEfficiencyResearch",
		"energyEfficiencyResearch",
		"efficiencyResearch",
	]);
});

function meteoriteHarness(plasma, extra = {}) {
	return harness({
		rates: { plasma, energy: 100000, hydrogen: 1000 },
		stock: { lunarite: 200, silicon: 200, uranium: 200 },
		technologies: { unlockEmc: purchasedTech(), unlockDyson: purchasedTech() },
		machines: [
			{ name: "printer", inputs: { plasma: 3 } },
			{ name: "web", inputs: { plasma: 21 } },
			{ name: "heater", count: 1, inputs: { energy: 1000, hydrogen: 10 } },
		],
		globals: {
			printerLunariteCost: 100,
			printerSiliconCost: 50,
			webLunariteCost: 100,
			webSiliconCost: 100,
			webUraniumCost: 100,
		},
		...extra,
	});
}

test("deficits preempt every normal purchase, even at full storage", () => {
	const state = harness({
		rates: { wood: -5 },
		stock: { wood: 100000 },
		machines: [{ name: "woodcutter" }, { name: "lab" }],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["woodcutter"]);
	assert.match(state.messages.at(-1), /Recovering wood: -5\/s/);
	assert.deepEqual(state.gathering, ["oil", "metal", "wood", "gem"]);
});

test("blocked recovery still gathers freely and identifies the blocker", () => {
	const state = harness({
		rates: { wood: -5 },
		machines: [{ name: "woodcutter", affordable: false }],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, []);
	assert.deepEqual(state.gathering, ["oil", "metal", "wood", "gem"]);
	assert.match(
		state.messages.at(-1),
		/woodcutter needs construction resources/,
	);
});

test("recovery builds at most one producer and stops at zero", () => {
	const state = harness({
		rates: { wood: -5, energy: -1 },
		machines: [{ name: "woodcutter" }, { name: "solarPanel" }],
	});
	assert.equal(state.monkey.recoverProduction(), true);
	assert.equal(state.purchases.length, 1);
	state.rates.wood = 0;
	state.rates.energy = 0;
	state.monkey.beginTick();
	assert.equal(state.monkey.recoverProduction(), false);
});

test("shared budget prevents cumulative overspending and does not credit new output", () => {
	const state = harness({
		rates: { energy: 15 },
		machines: [
			{ name: "solarPanel" },
			{ name: "laserCutter", inputs: { energy: 10 } },
			{ name: "scorcher", inputs: { energy: 10 } },
		],
	});
	state.context.solarPanelOutput = 100;
	assert.equal(
		state.monkey.tryBuildProducer("energy", "solarPanel").kind,
		state.monkey.status.SUCCESS,
	);
	assert.equal(state.monkey.budget.energy, 15);
	assert.equal(
		state.monkey.tryBuildProducer("wood", "laserCutter").kind,
		state.monkey.status.SUCCESS,
	);
	assert.equal(
		state.monkey.tryBuildProducer("silicon", "scorcher").kind,
		state.monkey.status.INPUTS,
	);
	assert.equal(state.monkey.budget.energy, 5);
	assert.deepEqual(state.purchases, ["solarPanel", "laserCutter"]);
});

test("input debit includes the energy efficiency discount", () => {
	const state = harness({
		rates: { energy: 10 },
		technologies: { energyEfficiencyResearch: purchasedTech({ current: 50 }) },
		machines: [
			{ name: "laserCutter", inputs: { energy: 10 } },
			{ name: "scorcher", inputs: { energy: 10 } },
		],
	});
	state.monkey.tryBuildProducer("wood", "laserCutter");
	state.monkey.tryBuildProducer("silicon", "scorcher");
	assert.deepEqual(state.purchases, ["laserCutter", "scorcher"]);
	assert.equal(state.monkey.budget.energy, 0);
});

test("recovery cannot worsen another deficit", () => {
	const state = harness({
		rates: { wood: -5, energy: -1 },
		machines: [
			{ name: "laserCutter", inputs: { energy: 10 } },
			{ name: "woodcutter" },
		],
	});
	state.monkey.recoverProduction();
	assert.deepEqual(state.purchases, ["woodcutter"]);
});

test("producer results distinguish locked, disabled, inputs, affordability and errors", () => {
	const cases = [
		[{ locked: true }, {}, "LOCKED"],
		[{}, { charcoalToggled: false }, "DISABLED"],
		[{ inputs: { wood: 2 } }, {}, "INPUTS"],
		[{ affordable: false }, {}, "UNAFFORDABLE"],
		[{ error: "broken" }, {}, "ERROR"],
	];
	for (const [options, globals, expected] of cases) {
		const state = harness({
			machines: [{ name: "woodburner", ...options }],
			globals,
		});
		assert.equal(
			state.monkey.tryBuildProducer("charcoal", "woodburner").kind,
			state.monkey.status[expected],
		);
		assert.deepEqual(state.purchases, []);
	}
});

test("power locks and starvation block powered machines but allow free producers", () => {
	for (const globals of [{ globalEnergyLock: true }, { energyLow: true }]) {
		const state = harness({
			rates: { energy: 100 },
			machines: [
				{ name: "laserCutter", inputs: { energy: 10 } },
				{ name: "woodcutter" },
			],
			globals,
		});
		assert.equal(
			state.monkey.tryBuildProducer("wood", "laserCutter").kind,
			state.monkey.status.DISABLED,
		);
		assert.equal(
			state.monkey.tryBuildProducer("wood", "woodcutter").kind,
			state.monkey.status.SUCCESS,
		);
	}
});

test("normal tick builds advanced wood, silicon and labs through the shared budget", () => {
	const state = harness({
		rates: { energy: 1000, wood: 10, plasma: 1 },
		stock: { energy: 10000 },
		machines: [
			{ name: "laserCutter", inputs: { energy: 10 } },
			{ name: "scorcher", inputs: { energy: 10 } },
			{ name: "lab" },
		],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["lab", "laserCutter", "scorcher"]);
	assert.equal(state.monkey.budget.energy, 980);
	assert.deepEqual(state.canceled, []);
});

test("waiting for T4 still builds power, resources and labs with full energy storage", () => {
	const state = harness({
		rates: { energy: 1000, wood: 10, plasma: 1 },
		stock: { energy: 10000, science: 100 },
		storage: { energy: 10000 },
		technologies: { unlockLabT4: research(50000000) },
		machines: [
			{ name: "solarPanel" },
			{ name: "laserCutter", inputs: { energy: 10 } },
			{ name: "scorcher", inputs: { energy: 10 } },
			{ name: "lab", inputs: { energy: 10 } },
		],
	});
	const plan = { textContent: "" };
	const getElement = state.context.document.getElementById;
	state.context.document.getElementById = (id) =>
		id === "automonkeyPlan" ? plan : getElement(id);
	state.monkey.run();
	assert.deepEqual(state.purchases, [
		"solarPanel",
		"lab",
		"laserCutter",
		"scorcher",
	]);
	assert.equal(state.technologies.unlockLabT4.current, 0);
	assert.match(
		plan.textContent,
		/Building affordable resource, power and science producers/,
	);
	assert.match(plan.textContent, /Waiting for T4 science/);
	assert.equal(state.monkey.budget.energy, 970);
	assert.deepEqual(state.canceled, []);
});

test("full fuel storage does not block production needed for more power", () => {
	const state = harness({
		rates: { energy: 1000, wood: 10, uranium: 0, plasma: 1 },
		stock: { energy: 10000, uranium: 100 },
		storage: { uranium: 100 },
		machines: [{ name: "grinder", inputs: { energy: 10 } }],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["grinder"]);
	assert.equal(state.monkey.budget.energy, 990);
});

test("finite storage uses >= and the correct gem ID; science stays unlimited", () => {
	const state = harness({
		stock: { gem: 101 },
		storage: { gem: 100 },
		machines: [{ name: "gemMiner" }, { name: "lab" }],
	});
	assert.equal(state.monkey.maxedOut("gem"), true);
	state.monkey.buildProducers("gem");
	state.monkey.buildProducers("science");
	assert.deepEqual(state.purchases, ["lab"]);
});

test("bootstraps one Super-Heater without repeated zero-output purchases", () => {
	const state = harness({
		rates: { energy: 1000, hydrogen: 10 },
		machines: [{ name: "heater", inputs: { energy: 1000, hydrogen: 10 } }],
	});
	assert.equal(state.monkey.ensurePlasmaProduction(), true);
	state.monkey.beginTick();
	assert.equal(state.monkey.ensurePlasmaProduction(), false);
	assert.deepEqual(state.purchases, ["heater"]);
});

test("meteorite target grows plasma after the first heater and never spends new output immediately", () => {
	const state = meteoriteHarness(1);
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, ["heater"]);
	assert.equal(state.monkey.budget.plasma, 1);
	assert.match(state.messages.at(-1), /supply web/);
	state.rates.plasma = 22;
	state.monkey.beginTick();
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, ["heater", "web"]);
	assert.equal(state.monkey.budget.plasma, 1);
});

test("meteorite reserve boundary is exact and shared between multiple same-tick purchases", () => {
	for (const [plasma, expected] of [
		[3.99, "INPUTS"],
		[4, "SUCCESS"],
	]) {
		const state = meteoriteHarness(plasma);
		assert.equal(
			state.monkey.tryBuildProducer("meteorite", "printer").kind,
			state.monkey.status[expected],
		);
	}
	const state = meteoriteHarness(24);
	assert.equal(
		state.monkey.tryBuildProducer("meteorite", "web").kind,
		state.monkey.status.SUCCESS,
	);
	assert.equal(
		state.monkey.tryBuildProducer("meteorite", "printer").kind,
		state.monkey.status.INPUTS,
	);
});

test("meteorite target respects current costs and Printer T1Price discount", () => {
	const state = meteoriteHarness(4, {
		stock: { lunarite: 50, silicon: 25 },
		globals: {
			T1Price: 0.5,
			printerLunariteCost: 100,
			printerSiliconCost: 50,
			webLunariteCost: 100,
			webSiliconCost: 100,
			webUraniumCost: 100,
		},
	});
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, ["printer"]);
});

test("meteorite production is gated by both researches, storage and the player toggle", () => {
	for (const mutate of [
		(state) => {
			state.technologies.unlockEmc.current = 0;
		},
		(state) => {
			state.technologies.unlockDyson.current = 0;
		},
		(state) => {
			state.stock.meteorite = 100000;
		},
		(state) => {
			state.context.meteoriteToggled = false;
		},
	]) {
		const state = meteoriteHarness(100);
		mutate(state);
		state.monkey.buildMeteoriteProduction();
		assert.deepEqual(state.purchases, []);
	}
});

test("complete Plasma, EMC and Dyson two-stage research sequence spends live balances", () => {
	const technologies = Object.fromEntries(
		["unlockPlasma", "unlockEmc", "unlockDyson"].map((id) => [
			id,
			{
				unlocked: false,
				current: 0,
				maxLevel: 1,
				cost: {
					science: {
						unlockPlasma: 40000,
						unlockEmc: 60000,
						unlockDyson: 100000,
					}[id],
				},
			},
		]),
	);
	const state = harness({
		technologies,
		stock: {
			hydrogen: 1500,
			uranium: 1500,
			oil: 15000,
			wood: 15000,
			energy: 175000,
			plasma: 10100,
			science: 200000,
		},
	});
	for (const [id, func, cost] of [
		[
			"unlockPlasma",
			"unlockPlasmaResearch",
			{ hydrogen: 1500, uranium: 1500, oil: 15000, wood: 15000 },
		],
		["unlockEmc", "unlockEmcResearch", { energy: 75000, plasma: 100 }],
		["unlockDyson", "unlockDysonResearch", { energy: 100000, plasma: 10000 }],
	]) {
		state.available.set(func, true);
		state.context[func] = () => {
			for (const [resource, amount] of Object.entries(cost))
				state.stock[resource] -= amount;
			technologies[id].unlocked = true;
		};
	}
	state.monkey.unlockProgressionResearch();
	assert.deepEqual(state.purchases, [
		"unlockPlasma",
		"unlockEmc",
		"unlockDyson",
	]);
	assert.equal(state.stock.science, 0);
	assert.equal(state.stock.energy, 0);
	assert.equal(state.stock.plasma, 0);
	state.monkey.unlockProgressionResearch();
	assert.equal(state.purchases.length, 3);
});

test("research checks locked state, finite limits, affordability and unlimited upgrades", () => {
	const technologies = {
		locked: { unlocked: false, current: 0, maxLevel: 1, cost: {} },
		complete: purchasedTech(),
		expensive: {
			unlocked: true,
			current: 0,
			maxLevel: 1,
			cost: { science: 10 },
		},
		repeatable: {
			unlocked: true,
			current: 2,
			maxLevel: -1,
			cost: { science: 1 },
		},
	};
	const state = harness({ technologies, stock: { science: 2 } });
	for (const [id, expected] of [
		["locked", "LOCKED"],
		["complete", "COMPLETE"],
		["expensive", "UNAFFORDABLE"],
		["repeatable", "SUCCESS"],
	])
		assert.equal(
			state.monkey.tryBuyResearch(id).kind,
			state.monkey.status[expected],
		);
	assert.equal(technologies.repeatable.current, 3);
});

test("progression research has priority over repeatable upgrades", () => {
	const state = harness({
		stock: { science: 60000 },
		technologies: {
			unlockEmc: {
				unlocked: true,
				current: 0,
				maxLevel: 1,
				cost: { science: 60000 },
			},
			scienceEfficiencyResearch: {
				unlocked: true,
				current: 0,
				maxLevel: -1,
				cost: { science: 60000 },
			},
		},
	});
	state.monkey.unlockProgressionResearch();
	state.monkey.buyEarlyScience();
	assert.deepEqual(state.purchases, ["unlockEmc"]);
});

function dysonHarness(globals = {}) {
	const state = harness({
		technologies: {
			unlockDyson: purchasedTech(),
			unlockDysonSphere: purchasedTech(),
		},
		stock: { rocketFuel: 100 },
		globals: { ring: 3, swarm: 6, ...globals },
	});
	for (const target of ["ring", "swarm", "sphere"]) {
		const func = `build${target[0].toUpperCase()}${target.slice(1)}`;
		state.available.set(func, true);
		state.context[func] = () => {
			state.context[target]++;
			state.context.dyson -= state.context[`${target}SegmentCost`];
		};
	}
	state.available.set("getDyson", true);
	state.context.getDyson = () => {
		state.context.dyson++;
		state.purchases.push("dyson");
	};
	return state;
}

test("Dyson respects actual segment and fuel costs, and accumulates after failed assembly", () => {
	const state = dysonHarness({
		ring: 2,
		swarm: 0,
		dyson: 5,
		ringSegmentCost: 5,
	});
	state.context.buildRing = () => {};
	state.monkey.buildDyson();
	assert.equal(state.context.ring, 2);
	assert.deepEqual(state.messages, []);
	state.context.dyson = 4;
	state.stock.rocketFuel = 0;
	state.monkey.buildDyson();
	assert.equal(state.context.dyson, 5);
	assert.deepEqual(state.purchases, ["dyson"]);
});

test("six-swarm cap proceeds to a sphere and only successful counts produce messages", () => {
	const state = dysonHarness({ dyson: 250 });
	state.monkey.buildDyson();
	assert.equal(state.context.swarm, 6);
	assert.equal(state.context.sphere, 1);
	assert.match(state.messages.at(-1), /Built Dyson sphere/);
	state.monkey.buildDyson();
	assert.equal(state.context.sphere, 1);
});

test("Dyson enforces research and sphere conquest eligibility", () => {
	const state = dysonHarness({ dyson: 250 });
	state.technologies.unlockDysonSphere.current = 0;
	state.monkey.buildDyson();
	assert.equal(state.context.sphere, 0);
	state.technologies.unlockDysonSphere.current = 1;
	state.context.sphere = 1;
	state.monkey.buildDyson();
	assert.equal(state.context.sphere, 1);
	assert.deepEqual(state.messages, []);
});

test("segments continue accumulating while swarm assembly research is locked", () => {
	const state = dysonHarness({ swarm: 0, dyson: 50 });
	state.technologies.unlockDysonSphere.current = 0;
	state.monkey.buildDyson();
	assert.equal(state.context.swarm, 0);
	assert.equal(state.context.dyson, 51);
});

test("unexpected tick errors stop the interval and appear in the status span", () => {
	const state = harness({
		rates: { wood: -1 },
		machines: [{ name: "woodcutter", error: "purchase broke" }],
	});
	state.monkey.run();
	assert.deepEqual(state.canceled, [1]);
	assert.equal(state.context.monkeyrunner.timeoutID, null);
	assert.match(state.messages.at(-1), /Stopped: Error: purchase broke/);
});

test("resource availability follows legacy navigation even when entry flags are stale", () => {
	const state = harness();
	state.context.Game.resources.getResourceData = () => ({ unlocked: false });
	state.monkey.manualResource();
	assert.deepEqual(state.gathering, ["oil", "metal", "wood", "gem"]);
	state.context.document.getElementById = () => ({
		classList: { contains: () => true },
		style: {},
		parentElement: null,
	});
	assert.equal(state.monkey.isResourceAvailable("oil"), false);
});

test("a hidden top-level navigation tab prevents purchases from its inactive panel", () => {
	const state = harness({ machines: [{ name: "lab" }] });
	const pane = {
		id: "research",
		classList: { contains: () => false },
		style: {},
		parentElement: {
			id: "tabContent",
			classList: { contains: () => false },
			style: {},
			parentElement: null,
		},
	};
	state.context.document.querySelectorAll = () => [
		{ classList: { contains: () => false }, style: {}, parentElement: pane },
	];
	state.context.document.querySelector = () => ({
		classList: { contains: () => true },
		style: {},
		parentElement: null,
	});
	assert.equal(
		state.monkey.tryBuildProducer("science", "lab").kind,
		state.monkey.status.LOCKED,
	);
	assert.deepEqual(state.purchases, []);
});

test("Dyson costs resolve global lexical constants without window properties", () => {
	const state = dysonHarness({ dyson: 250 });
	for (const name of [
		"ringSegmentCost",
		"swarmSegmentCost",
		"sphereSegmentCost",
		"ringRocketFuelCost",
		"swarmRocketFuelCost",
		"sphereRocketFuelCost",
	]) {
		const value = state.context[name];
		delete state.context[name];
		vm.runInContext(`const ${name} = ${value};`, state.context);
	}
	state.context.buildSphere = () => {
		state.context.sphere++;
		state.context.dyson -= 250;
	};
	state.monkey.buildDyson();
	assert.equal(state.context.sphere, 1);
	assert.equal(state.context.dyson, 0);
});

test("plasma growth respects disabled production and insufficient fuel production", () => {
	for (const disable of [
		(state) => {
			state.context.heaterToggled = false;
		},
		(state) => {
			state.monkey.budget.hydrogen = 9;
		},
	]) {
		const state = meteoriteHarness(1);
		disable(state);
		state.monkey.buildMeteoriteProduction();
		assert.deepEqual(state.purchases, []);
	}
});
