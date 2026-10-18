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
		heaterOutput: 1,
		plasmaticOutput: 10,
		bathOutput: 140,
		heaterLunariteCost: 0,
		heaterGemCost: 0,
		heaterSiliconCost: 0,
		plasmaticLunariteCost: 0,
		plasmaticSiliconCost: 0,
		plasmaticMeteoriteCost: 0,
		bathLavaCost: 0,
		bathGoldCost: 0,
		bathMeteoriteCost: 0,
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
		for (const [resource, amount] of Object.entries(machine.costs ?? {}))
			context[
				`${machine.name}${resource[0].toUpperCase()}${resource.slice(1)}Cost`
			] = amount;
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

test("tab appends without reference-node insertion and remains safe when pasted again", () => {
	for (const directChild of [true, false]) {
		const state = harness();
		const nodes = new Map();
		const createNode = () => ({
			style: {},
			setAttribute() {},
			closest: () => ({}),
			appendChild() {},
		});
		const tabList = {
			querySelector: () =>
				directChild ? { parentElement: tabList } : { parentElement: {} },
			insertBefore: () => {
				throw new DOMException(
					"Reference-node insertion is unsafe",
					"NotFoundError",
				);
			},
			appendChild: (tab) => {
				nodes.set(tab.id, tab);
			},
		};
		const elements = new Map([
			["#automonkeyEnabled", createNode()],
			["#automonkeyEmcEnabled", createNode()],
			["#automonkeyEmcResource", createNode()],
			["#automonkeyEnergyRunway", createNode()],
			["#automonkeyPlan", createNode()],
			["#automonkeyMessage", createNode()],
		]);
		const panel = {
			prepend() {},
			style: {},
			querySelector: (selector) => elements.get(selector),
			querySelectorAll: () => [],
		};
		nodes.set("tabList", tabList);
		nodes.set("tabContent", createNode());
		nodes.set("automonkeyPanel", panel);
		state.context.document.getElementById = (id) => nodes.get(id) ?? null;
		state.context.document.createElement = createNode;
		state.monkey.injectCustomTab();
		const first = nodes.get("automonkeyTab");
		assert.ok(first);
		state.monkey.injectCustomTab();
		assert.equal(nodes.get("automonkeyTab"), first);
	}
});

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

test("energy budgeting includes enabled plasma consumption hidden by low stock", () => {
	const state = harness({
		rates: { energy: 1000 },
		stock: { energy: 621197 },
		technologies: { energyEfficiencyResearch: purchasedTech({ current: 25 }) },
		machines: [{ name: "bath", count: 3, inputs: { energy: 15000 } }],
		globals: { calculateEnergyOutput: () => 1000 },
	});
	assert.equal(state.monkey.budget.energy, -32750);
	assert.ok(state.monkey.energySecondsAfterConsumption(0) < 20);
	assert.equal(
		state.monkey.checkProducer("plasma", "bath").kind,
		state.monkey.status.INPUTS,
	);
	state.context.bathToggled = false;
	state.monkey.beginTick();
	assert.equal(state.monkey.budget.energy, 1000);
});

test("steady energy budgeting accounts for all owned machines and retains worse sampled rates", () => {
	const state = harness({
		rates: { energy: 900 },
		machines: [{ name: "laserCutter", count: 2, inputs: { energy: 100 } }],
		globals: { calculateEnergyOutput: () => 1000 },
	});
	assert.equal(state.monkey.budget.energy, 800);
	state.rates.energy = -2000;
	state.monkey.beginTick();
	assert.equal(state.monkey.budget.energy, -2000);
});

test("stale game updates prevent repeated purchases against an old production snapshot", () => {
	const state = harness({
		rates: { energy: 1000 },
		machines: [{ name: "lab" }],
	});
	state.context.Game.lastFixedUpdate = Date.now() - 5000;
	state.monkey.run();
	assert.deepEqual(state.purchases, []);
	assert.deepEqual(state.gathering, []);
	assert.match(
		state.messages.at(-1),
		/Waiting for the game to refresh production/,
	);
	assert.deepEqual(state.canceled, []);
	state.context.Game.lastFixedUpdate = Date.now();
	state.monkey.run();
	assert.deepEqual(state.purchases, ["lab"]);
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
	assert.equal(state.monkey.affordabilityCountdown({ science: 10 }), "");
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
	assert.match(state.monkey.sciencePlan(), /Waiting for Meteorite.*0h 00m 10s/);
	state.technologies.unlockMeteorite.current = 1;
	assert.match(
		state.monkey.sciencePlan(),
		/Waiting for Plasma Storage Units.*0h 01m 00s/,
	);
});

test("plan explains T4 waiting with whole-number science costs", () => {
	const state = harness({
		stock: { science: 12.4 },
		technologies: { unlockLabT4: research(50000000) },
	});
	assert.match(
		state.monkey.sciencePlan(),
		/Waiting for T4 science: 12 \/ 50,000,000 science/,
	);
	assert.match(
		state.monkey.sciencePlan(),
		/Higher battery tiers, PSUs and efficiency upgrades wait/,
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
		/Science-funded research and zero-power producers continue; other powered purchases are paused/,
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

test("T1 battery research precedes T4 while higher batteries and PSUs wait", () => {
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
	assert.deepEqual(state.purchases, ["unlockBatteries"]);
	state.stock.science = 106;
	state.monkey.buyEarlyScience();
	assert.deepEqual(state.purchases, [
		"unlockBatteries",
		"unlockLabT4",
		"unlockPSU",
		"unlockPSUT2",
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

test("every wonder stage spends current resource costs and completes only once", () => {
	const registry = harness().monkey.wonders;
	let state;
	const actions = {},
		globals = { buttonsHidden: [] },
		stock = {};
	for (const [, func, completed, prefix, resources] of registry) {
		for (const resource of resources) {
			globals[`${prefix}${resource[0].toUpperCase()}${resource.slice(1)}Cost`] =
				10;
			stock[resource] = 1000;
		}
		actions[func] = () => {
			for (const resource of resources) state.stock[resource] -= 10;
			state.context.buttonsHidden.push(completed);
			state.purchases.push(func);
		};
	}
	state = harness({ actions, globals, stock });
	state.monkey.buyWonders();
	assert.equal(state.purchases.length, 13);
	assert.equal(state.context.buttonsHidden.length, 13);
	assert.match(state.messages.at(-1), /Completed Stargate/);
	state.monkey.buyWonders();
	assert.equal(state.purchases.length, 13);
});

test("wonders respect unlocks, current costs and failed native purchases", () => {
	let calls = 0;
	const state = harness({
		stock: { meteorite: 10, ice: 20, silicon: 30 },
		globals: {
			buttonsHidden: [],
			meteoriteMeteoriteCost: 10,
			meteoriteIceCost: 20,
			meteoriteSiliconCost: 31,
		},
		actions: {
			achieveMeteoriteWonder: () => {
				calls++;
			},
		},
	});
	state.monkey.buyWonders();
	assert.equal(calls, 0);
	state.context.meteoriteSiliconCost = 30;
	state.available.set("achieveMeteoriteWonder", false);
	state.monkey.buyWonders();
	assert.equal(calls, 0);
	state.available.set("achieveMeteoriteWonder", true);
	state.monkey.buyWonders();
	assert.equal(calls, 1);
	assert.deepEqual(state.messages, []);
});

test("hidden wonder navigation blocks activation even when its button exists", () => {
	let calls = 0;
	const state = harness({
		stock: { meteorite: 10, ice: 10, silicon: 10 },
		globals: {
			buttonsHidden: [],
			meteoriteActivateMeteoriteCost: 10,
			meteoriteActivateIceCost: 10,
			meteoriteActivateSiliconCost: 10,
		},
		actions: {
			activateMeteoriteWonder: () => {
				calls++;
			},
		},
	});
	const getElement = state.context.document.getElementById;
	state.context.document.getElementById = (id) =>
		id === "meteoriteWonderNav"
			? { classList: { contains: () => true }, style: {}, parentElement: null }
			: getElement(id);
	state.monkey.buyWonders();
	assert.equal(calls, 0);
});

test("meteorite wonder can complete and activate during energy recovery with live spending", () => {
	let state;
	state = harness({
		rates: { energy: -98 },
		stock: { meteorite: 30, ice: 30, silicon: 30 },
		globals: {
			buttonsHidden: [],
			meteoriteMeteoriteCost: 10,
			meteoriteIceCost: 10,
			meteoriteSiliconCost: 10,
			meteoriteActivateMeteoriteCost: 20,
			meteoriteActivateIceCost: 20,
			meteoriteActivateSiliconCost: 20,
		},
		actions: {
			achieveMeteoriteWonder: () => {
				for (const r of ["meteorite", "ice", "silicon"]) state.stock[r] -= 10;
				state.context.buttonsHidden.push("meteoriteWonderButton");
				state.available.set("activateMeteoriteWonder", true);
			},
			activateMeteoriteWonder: () => {
				for (const r of ["meteorite", "ice", "silicon"]) state.stock[r] -= 20;
				state.context.buttonsHidden.push("activateMeteoriteWonder");
			},
		},
	});
	state.available.set("activateMeteoriteWonder", false);
	state.monkey.run();
	assert.deepEqual(state.context.buttonsHidden, [
		"meteoriteWonderButton",
		"activateMeteoriteWonder",
	]);
	assert.equal(state.stock.meteorite, 0);
	assert.equal(state.stock.ice, 0);
	assert.match(state.messages.at(-1), /Completed Meteorite wonder activation/);
	assert.deepEqual(state.canceled, []);
});

test("blocked power recovery still buys affordable T4 science and energy efficiency", () => {
	const state = harness({
		rates: { energy: -98 },
		stock: { energy: 400000, science: 51252269 },
		technologies: {
			unlockLabT4: research(50000000),
			energyEfficiencyResearch: research(1000000, { maxLevel: 25 }),
		},
		machines: [{ name: "fusionReactor", affordable: false }, { name: "lab" }],
	});
	state.monkey.minimumEnergyRunway = 7200;
	state.monkey.run();
	assert.deepEqual(state.purchases, [
		"unlockLabT4",
		"energyEfficiencyResearch",
		"lab",
	]);
	assert.equal(state.stock.energy, 400000);
	assert.match(state.messages.at(-1), /Recovering energy: -98\/s/);
	assert.match(state.messages.at(-1), /Built lab/);
	assert.deepEqual(state.canceled, []);
});

test("recovery research preserves progression priority without spending energy on resource unlocks", () => {
	let resourceUnlocks = 0;
	const state = harness({
		rates: { energy: -98 },
		stock: { energy: 400000, science: 60000, plasma: 100 },
		technologies: {
			unlockEmc: research(60000, { unlocked: false }),
			unlockMeteorite: research(60000),
			unlockLabT4: research(60000),
		},
		actions: {
			unlockEmcResearch: () => {
				resourceUnlocks++;
			},
		},
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["unlockMeteorite"]);
	assert.equal(resourceUnlocks, 0);
	assert.equal(state.stock.energy, 400000);
});

test("all unlocked affordable science tiers can build during blocked, power-starved recovery", () => {
	const state = harness({
		rates: { energy: -98 },
		stock: { energy: 0 },
		globals: { energyLow: true, globalEnergyLock: true },
		machines: [
			{ name: "labT5", locked: true },
			{ name: "labT4", affordable: false },
			{ name: "labT3" },
			{ name: "labT2" },
			{ name: "lab" },
			{ name: "laserCutter", inputs: { energy: 10 } },
		],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["labT3", "labT2", "lab"]);
	assert.equal(state.monkey.budget.energy, -98);
	assert.deepEqual(state.canceled, []);
});

test("deficits allow science buildings while pausing other normal purchases", () => {
	const state = harness({
		rates: { wood: -5 },
		stock: { wood: 100000 },
		machines: [{ name: "woodcutter" }, { name: "lab" }],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["woodcutter", "lab"]);
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

for (const [price, expected] of [
	[49, true],
	[50, true],
	[51, false],
]) {
	test(`lower resource tier priced at ${price} obeys the inclusive half-price boundary`, () => {
		const state = harness({
			machines: [
				{ name: "vent", costs: { lunarite: 100 }, affordable: false },
				{ name: "spaceCow", costs: { lunarite: price } },
			],
		});
		state.monkey.buildProducers("methane");
		assert.deepEqual(state.purchases, expected ? ["spaceCow"] : []);
	});
}

test("weighted costs count meteorite tenfold and match the methane screenshot", () => {
	const state = harness({
		machines: [
			{
				name: "vent",
				costs: { lunarite: 111466, helium: 100748, meteorite: 835 },
				affordable: false,
			},
			{
				name: "spaceCow",
				costs: { lunarite: 46066, titanium: 51824, silicon: 74857 },
			},
		],
	});
	assert.equal(state.monkey.weightedProducerCost("methane", "vent"), 220564);
	assert.equal(
		state.monkey.weightedProducerCost("methane", "spaceCow"),
		172747,
	);
	state.monkey.buildProducers("methane");
	assert.deepEqual(state.purchases, []);
	assert.match(state.monkey.buildingPlans.get("methane"), /Saving for vent/);
});

test("tier comparisons use the next unlocked tier and refreshed prices", () => {
	const state = harness({
		machines: [
			{ name: "vent", costs: { lunarite: 100 }, locked: true },
			{ name: "spaceCow", costs: { lunarite: 51 } },
		],
	});
	state.monkey.buildProducers("methane");
	assert.deepEqual(state.purchases, ["spaceCow"]);
	state.monkey.beginTick();
	state.available.set("getVent", true);
	state.monkey.buildProducers("methane");
	assert.equal(state.purchases.filter((x) => x === "spaceCow").length, 1);
	state.monkey.beginTick();
	state.context.ventLunariteCost = 102;
	state.monkey.buildProducers("methane");
	assert.equal(state.purchases.filter((x) => x === "spaceCow").length, 2);
});

test("weighted first-tier price includes the game purchase discount", () => {
	const state = harness({
		globals: { T1Price: 0.5 },
		machines: [
			{ name: "suctionExcavator", costs: { gem: 100 }, affordable: false },
			{ name: "vacuum", costs: { gem: 100 } },
		],
	});
	assert.equal(state.monkey.weightedProducerCost("methane", "vacuum"), 50);
	state.monkey.buildProducers("methane");
	assert.deepEqual(state.purchases, ["vacuum"]);
});

test("price balancing does not block urgent recovery or science building purchases", () => {
	const state = harness({
		rates: { methane: -1 },
		machines: [
			{ name: "vent", costs: { lunarite: 100 }, affordable: false },
			{ name: "spaceCow", costs: { lunarite: 90 } },
			{ name: "labT2", costs: { wood: 100 }, affordable: false },
			{ name: "lab", costs: { wood: 90 } },
		],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["spaceCow", "lab"]);
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

function plasmaHarness(extra = {}) {
	return harness({
		rates: { energy: 20000, hydrogen: 200, helium: 200 },
		machines: [
			{ name: "heater", inputs: { energy: 1000, hydrogen: 10 } },
			{ name: "plasmatic", inputs: { energy: 8500, helium: 80 } },
			{ name: "bath", inputs: { energy: 15000, hydrogen: 100, helium: 100 } },
		],
		...extra,
	});
}

test("plasma selection compares actual output per energy rather than tier ordering", () => {
	const state = plasmaHarness();
	assert.equal(state.monkey.selectPlasmaProducer().producer, "bath");
	state.context.heaterOutput = 100;
	assert.equal(state.monkey.selectPlasmaProducer().producer, "heater");
	state.monkey.ensurePlasmaProduction();
	assert.deepEqual(state.purchases, ["heater"]);
	assert.equal(state.monkey.budget.plasma, 0);
});

test("initial plasma production can start with an efficient higher tier", () => {
	const state = plasmaHarness();
	state.monkey.ensurePlasmaProduction();
	assert.deepEqual(state.purchases, ["bath"]);
	state.monkey.buildPlasmaSupply("grow plasma");
	assert.deepEqual(state.purchases, ["bath"]);
});

test("plasma selection applies heater material discounts and the energy runway limit", () => {
	const state = plasmaHarness({
		rates: { energy: 1000, hydrogen: 200, helium: 200 },
		stock: { energy: 400000, lunarite: 50 },
		globals: { T1Price: 0.5, heaterLunariteCost: 100 },
	});
	assert.equal(state.monkey.plasmaCost("heater").lunarite, 50);
	assert.equal(state.monkey.selectPlasmaProducer().producer, "heater");
	state.monkey.buildPlasmaSupply("grow plasma");
	assert.deepEqual(state.purchases, ["heater"]);
	assert.equal(state.monkey.budget.energy, 0);
});

test("plasma saves for efficient T2 instead of repeatedly buying affordable heaters", () => {
	const state = plasmaHarness({
		rates: { energy: 20000, hydrogen: 200, helium: 200, lunarite: 10 },
		globals: { plasmaticLunariteCost: 100 },
	});
	state.available.set("getBath", false);
	state.monkey.buildPlasmaSupply("supply meteorite");
	assert.deepEqual(state.purchases, []);
	assert.match(state.monkey.plasmaPlan, /Saving for plasmatic.*0h 00m 10s/);
	const plan = { textContent: "" };
	state.context.document.getElementById = (id) =>
		id === "automonkeyPlan" ? plan : null;
	state.monkey.updatePlan();
	assert.match(plan.textContent, /Saving for plasmatic/);
	state.stock.lunarite = 100;
	state.monkey.beginTick();
	state.monkey.buildPlasmaSupply("supply meteorite");
	assert.deepEqual(state.purchases, ["plasmatic"]);
});

test("plasma recovery also saves for the efficient target", () => {
	const state = plasmaHarness({
		rates: {
			plasma: -1,
			energy: 20000,
			hydrogen: 200,
			helium: 200,
			lunarite: 10,
		},
		globals: { plasmaticLunariteCost: 100 },
	});
	state.available.set("getBath", false);
	state.monkey.recoverProduction();
	assert.deepEqual(state.purchases, []);
	assert.match(
		state.messages.at(-1),
		/plasmatic needs construction resources.*Estimated ready/,
	);
});

for (const blocker of ["locked", "disabled", "fuel", "storage", "stalled"]) {
	test(`plasma falls back when higher tiers are ${blocker}`, () => {
		const state = plasmaHarness();
		state.available.set("getBath", false);
		if (blocker === "locked") state.available.set("getPlasmatic", false);
		if (blocker === "disabled") state.context.plasmaticToggled = false;
		if (blocker === "fuel") state.monkey.budget.helium = 0;
		if (blocker === "storage") {
			state.context.plasmaticLunariteCost = 100001;
			state.rates.lunarite = 10;
		}
		if (blocker === "stalled") state.context.plasmaticLunariteCost = 100;
		state.monkey.buildPlasmaSupply("grow plasma");
		assert.deepEqual(state.purchases, ["heater"]);
	});
}

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

function rocketFixture(options = {}) {
	const state = harness(options);
	const rocket = {
		name: "Rocket Ship",
		htmlId: "roc_tier1Rocket",
		unlocked: true,
		built: false,
		cost: { shield: 50, engine: 25, aero: 15 },
	};
	const parts = Object.fromEntries(
		Object.entries(rocket.cost).map(([id, max]) => [
			id,
			{
				name: id,
				htmlId: `rocpart_${id}`,
				unlocked: true,
				count: 0,
				max,
				cost: { titanium: 10 },
			},
		]),
	);
	const visible = new Map(
		[rocket, ...Object.values(parts)].map((item) => [
			`${item.htmlId}_buy`,
			true,
		]),
	);
	const originalGet = state.context.document.getElementById;
	state.context.document.getElementById = (id) =>
		visible.has(id)
			? {
					classList: { contains: () => !visible.get(id) },
					style: {},
					parentElement: null,
				}
			: originalGet(id);
	const navigation = { unlocked: true };
	state.context.Game.interstellar.getInterstellarData = () => navigation;
	state.context.Game.interstellar.rocketParts = {
		getPartData: (id) => parts[id],
		updateCost: (id) => {
			parts[id].cost.titanium = Math.floor(10 * 1.1 ** parts[id].count);
		},
		buildPart(id, amount) {
			assert.equal(amount, 1);
			const part = parts[id];
			if (state.stock.titanium < part.cost.titanium) return;
			state.stock.titanium -= part.cost.titanium;
			part.count++;
			state.purchases.push(id);
			this.updateCost(id);
		},
	};
	state.context.Game.interstellar.rocket = {
		getRocketData: () => rocket,
		buildRocket() {
			rocket.built = true;
			state.purchases.push("rocket");
		},
	};
	return { ...state, rocket, parts, visible, navigation };
}

test("rocket buys only missing parts and assembles immediately, then stops", () => {
	const state = rocketFixture({ stock: { titanium: 1e9 } });
	state.parts.engine.count = 25;
	state.parts.aero.count = 15;
	state.monkey.buyRocket();
	assert.equal(state.parts.shield.count, 50);
	assert.equal(state.purchases.filter((id) => id === "shield").length, 50);
	assert.equal(state.purchases.at(-1), "rocket");
	assert.equal(state.rocket.built, true);
	const remaining = state.stock.titanium;
	state.monkey.buyRocket();
	assert.equal(state.stock.titanium, remaining);
	assert.equal(state.purchases.length, 51);
});

test("rocket spending uses each current escalating price and resumes next tick", () => {
	const state = rocketFixture({
		stock: { titanium: 21 },
		rates: { titanium: 10 },
	});
	state.monkey.buyRocket();
	assert.equal(state.parts.shield.count, 2);
	assert.equal(state.stock.titanium, 0);
	assert.equal(state.parts.engine.count, 0);
	assert.match(state.monkey.rocketPlan, /shield: 2\/50/);
	state.stock.titanium = 10;
	state.monkey.beginTick();
	state.monkey.buyRocket();
	assert.equal(state.parts.shield.count, 2);
	assert.equal(state.parts.engine.count, 1);
	assert.equal(state.stock.titanium, 0);
});

test("rocket parts respect navigation, ship and individual part availability", () => {
	for (const blocked of ["navigation", "rocket", "button", "part"]) {
		const state = rocketFixture({ stock: { titanium: 1e9 } });
		if (blocked === "navigation") state.navigation.unlocked = false;
		if (blocked === "rocket") state.rocket.unlocked = false;
		if (blocked === "button") state.visible.set("roc_tier1Rocket_buy", false);
		if (blocked === "part") state.parts.shield.unlocked = false;
		state.monkey.buyRocket();
		assert.equal(state.parts.shield.count, 0);
		assert.equal(state.rocket.built, false);
		if (blocked === "part")
			assert.match(state.monkey.rocketPlan, /shield: waiting for unlock/);
		else assert.equal(state.purchases.length, 0);
	}
	const state = rocketFixture({ stock: { titanium: 1e9 } });
	state.visible.set("rocpart_shield_buy", false);
	state.monkey.buyRocket();
	assert.equal(state.parts.shield.count, 0);
	assert.equal(state.parts.engine.count, 25);
});

test("failed native part or ship purchases do not loop or report success", () => {
	const state = rocketFixture({ stock: { titanium: 1e9 } });
	let attempts = 0;
	state.context.Game.interstellar.rocketParts.buildPart = () => {
		attempts++;
	};
	state.monkey.buyRocket();
	assert.equal(attempts, 3);
	assert.equal(state.purchases.length, 0);
	for (const [id, amount] of Object.entries(state.rocket.cost))
		state.parts[id].count = amount;
	state.context.Game.interstellar.rocket.buildRocket = () => {};
	state.monkey.buyRocket();
	assert.equal(state.monkey.lastAction, null);
	assert.match(state.monkey.rocketPlan, /waiting for Rocket Ship assembly/);
});

test("rocket parts and assembly continue during energy recovery", () => {
	const state = rocketFixture({
		rates: { energy: -100 },
		stock: { titanium: 1e9 },
	});
	state.monkey.run();
	assert.equal(state.rocket.built, true);
	assert.equal(state.parts.shield.count, 50);
	assert.equal(state.parts.engine.count, 25);
	assert.equal(state.parts.aero.count, 15);
	assert.deepEqual(state.canceled, []);
});

for (const [price, buysPrinter] of [
	[149, true],
	[150, true],
	[151, false],
]) {
	test(`meteorite lower tier at ${price} obeys the inclusive half-price rule`, () => {
		const state = meteoriteHarness(4, {
			stock: { lunarite: 1000, silicon: 1000, uranium: 0 },
			globals: {
				printerLunariteCost: price,
				printerSiliconCost: 0,
				webLunariteCost: 100,
				webSiliconCost: 100,
				webUraniumCost: 100,
			},
		});
		state.monkey.buildMeteoriteProduction();
		assert.deepEqual(state.purchases, buysPrinter ? ["printer"] : []);
		assert.equal(state.monkey.budget.plasma, buysPrinter ? 1 : 4);
		if (!buysPrinter) {
			assert.match(
				state.monkey.buildingPlans.get("meteorite"),
				/Saving for web/,
			);
			assert.equal(state.context.heater, 1);
		}
	});
}

test("meteorite comparisons refresh costs, include Printer discount and skip locked tiers", () => {
	const state = meteoriteHarness(4, {
		stock: { lunarite: 1000, silicon: 1000, uranium: 0 },
		globals: {
			T1Price: 0.5,
			printerLunariteCost: 300,
			printerSiliconCost: 2,
			webLunariteCost: 100,
			webSiliconCost: 100,
			webUraniumCost: 100,
		},
	});
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, []);
	assert.equal(state.monkey.weightedProducerCost("meteorite", "printer"), 151);
	state.context.printerSiliconCost = 0;
	state.monkey.beginTick();
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, ["printer"]);
	state.available.set("getWeb", false);
	state.context.printerSiliconCost = 2000;
	state.monkey.beginTick();
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, ["printer", "printer"]);
});

test("meteorite saving switches to the higher tier once affordable, preserving plasma reserve", () => {
	const state = meteoriteHarness(22, {
		stock: { lunarite: 1000, silicon: 1000, uranium: 0 },
		globals: {
			printerLunariteCost: 151,
			printerSiliconCost: 0,
			webLunariteCost: 100,
			webSiliconCost: 100,
			webUraniumCost: 100,
		},
	});
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, []);
	state.stock.uranium = 100;
	state.monkey.beginTick();
	state.monkey.buildMeteoriteProduction();
	assert.deepEqual(state.purchases, ["web"]);
	assert.equal(state.monkey.budget.plasma, 1);
	assert.equal(state.monkey.buildingPlans.has("meteorite"), false);
});

test("automation toggle defaults on, stops all tick actions, and resumes without duplicate intervals", () => {
	const state = harness({ machines: [{ name: "lab" }] });
	const toggle = {},
		plan = {};
	const getElement = state.context.document.getElementById;
	state.context.document.getElementById = (id) =>
		id === "automonkeyEnabled"
			? toggle
			: id === "automonkeyPlan"
				? plan
				: getElement(id);
	state.monkey.updateEnabledControl();
	assert.equal(state.monkey.enabled, true);
	assert.equal(toggle.checked, true);
	let starts = 0;
	state.context.setInterval = () => {
		starts++;
		return 2;
	};
	state.monkey.setEnabled(false);
	assert.equal(toggle.checked, false);
	assert.deepEqual(state.canceled, [1]);
	assert.equal(state.context.monkeyrunner.timeoutID, null);
	state.monkey.run();
	assert.deepEqual(state.purchases, []);
	assert.deepEqual(state.gathering, []);
	assert.match(plan.textContent, /Automation is off/);
	state.monkey.setEnergyRunwayHours(2);
	assert.match(plan.textContent, /Automation is off/);
	state.monkey.setEnabled(true);
	state.monkey.setEnabled(true);
	assert.equal(starts, 1);
	assert.equal(toggle.checked, true);
	state.monkey.run();
	assert.deepEqual(state.purchases, ["lab"]);
	assert.equal(state.gathering.length, 4);
});

test("reused tab toggle binds to the current automation and reflects its state", () => {
	const state = harness();
	const control = {};
	const toggle = { closest: () => control };
	const children = [{}, control];
	const elements = new Map([
		["#automonkeyEnabled", toggle],
		["#automonkeyEmcEnabled", {}],
		["#automonkeyEmcResource", {}],
		["#automonkeyEnergyRunway", {}],
		["#automonkeyPlan", { style: {} }],
		["#automonkeyMessage", {}],
	]);
	const panel = {
		prepend(node) {
			children.splice(children.indexOf(node), 1);
			children.unshift(node);
		},
		style: {},
		querySelector: (selector) => elements.get(selector),
		querySelectorAll: () => [],
	};
	const nodes = new Map([
		["tabList", {}],
		["tabContent", {}],
		["automonkeyPanel", panel],
		["automonkeyTab", {}],
		["automonkeyEnabled", toggle],
	]);
	state.context.document.getElementById = (id) => nodes.get(id);
	state.monkey.injectCustomTab();
	assert.equal(children[0], control);
	assert.equal(toggle.checked, true);
	toggle.checked = false;
	toggle.onchange();
	assert.equal(state.monkey.enabled, false);
	state.monkey.injectCustomTab();
	assert.equal(children[0], control);
	assert.equal(children.length, 2);
	assert.equal(toggle.checked, false);
	toggle.checked = true;
	toggle.onchange();
	assert.equal(state.monkey.enabled, true);
});

test("tick errors turn the automation toggle off while preserving the error message", () => {
	const state = harness();
	const toggle = {};
	state.context.document.getElementById = (id) =>
		id === "automonkeyEnabled" ? toggle : null;
	state.monkey.buyWonders = () => {
		throw new Error("broken purchase");
	};
	state.monkey.run();
	assert.equal(state.monkey.enabled, false);
	assert.equal(toggle.checked, false);
	assert.match(state.messages.at(-1), /Stopped: Error: broken purchase/);
	assert.equal(state.context.monkeyrunner.timeoutID, null);
});

function emcHarness(extra = {}) {
	const state = harness({
		stock: { energy: 1000, metal: 0 },
		rates: { energy: 10 },
		technologies: { unlockEmc: purchasedTech() },
		globals: { metalEmcVal: 2, oilEmcVal: 5, emcAmount: "Max" },
		...extra,
	});
	state.context.convertEnergy = (resource) => {
		const amount = state.context.emcAmount;
		const price = state.context[`${resource}EmcVal`];
		state.stock.energy -= amount * price;
		state.stock[resource] = (state.stock[resource] ?? 0) + amount;
		state.purchases.push(resource);
	};
	return state;
}

test("auto EMC defaults off and operates independently of the main toggle", () => {
	const state = emcHarness();
	state.monkey.runAutoEmc();
	assert.deepEqual(state.purchases, []);
	state.monkey.setAutoEmc(true);
	state.monkey.setEnabled(false);
	assert.equal(state.context.monkeyrunner.timeoutID, 1);
	state.monkey.runAutoEmc();
	assert.equal(state.stock.metal, 500);
	assert.equal(state.stock.energy, 0);
	assert.equal(state.context.emcAmount, "Max");
	state.monkey.setAutoEmc(false);
	assert.equal(state.context.monkeyrunner.timeoutID, null);
});

test("auto EMC resource selection respects storage and uses current prices", () => {
	const state = emcHarness({
		stock: { energy: 1000, oil: 95 },
		storage: { oil: 100 },
	});
	state.monkey.setAutoEmc(true, "oil");
	state.monkey.runAutoEmc();
	assert.equal(state.stock.oil, 100);
	assert.equal(state.stock.energy, 975);
	state.monkey.runAutoEmc();
	assert.deepEqual(state.purchases, ["oil"]);
	state.monkey.setAutoEmc(true, "meteorite");
	assert.equal(state.monkey.autoEmcResource, "oil");
});

test("auto EMC preserves energy runway including same-tick consumption", () => {
	const state = emcHarness({
		stock: { energy: 144010 },
		rates: { energy: -10 },
	});
	state.monkey.setAutoEmc(true);
	state.monkey.runAutoEmc();
	assert.equal(state.stock.metal, 5);
	assert.equal(state.stock.energy, 144000);
	state.monkey.runAutoEmc();
	assert.equal(state.purchases.length, 1);
	state.stock.energy = 200000;
	state.monkey.budget.energy = -20;
	state.monkey.runAutoEmc();
	assert.equal(state.purchases.length, 1);
});

test("auto EMC waits for research, visible resource, fresh data and energy locks", () => {
	for (const block of ["research", "resource", "stale", "lock", "low"]) {
		const state = emcHarness();
		state.monkey.setAutoEmc(true);
		if (block === "research") state.technologies.unlockEmc.current = 0;
		if (block === "resource")
			state.context.document.getElementById = () => null;
		if (block === "stale")
			state.context.Game.lastFixedUpdate = Date.now() - 3000;
		if (block === "lock") state.context.globalEnergyLock = true;
		if (block === "low") state.context.energyLow = true;
		state.monkey.runAutoEmc();
		assert.deepEqual(state.purchases, []);
	}
});

test("auto EMC failure restores conversion quantity and disables only EMC", () => {
	const state = emcHarness();
	state.context.convertEnergy = () => {
		throw new Error("conversion failed");
	};
	state.monkey.setAutoEmc(true);
	state.monkey.runAutoEmc();
	assert.equal(state.monkey.autoEmcEnabled, false);
	assert.equal(state.monkey.enabled, true);
	assert.equal(state.context.emcAmount, "Max");
	assert.equal(state.context.monkeyrunner.timeoutID, 1);
});

function interstellarHarness(options = {}) {
	const state = harness({
		rates: { energy: 100, plasma: 101, ice: 12000 },
		stock: { metal: 1000, oil: 1000, silver: 1000, ice: 1000, meteorite: 1000 },
		globals: { sphere: 1, antimatterToggled: true },
		...options,
	});
	const entries = {
		military: {
			name: "Scout",
			htmlId: "milit_scout",
			unlocked: true,
			count: 0,
			cost: { metal: 100 },
		},
		antimatter: {
			name: "Alcubierre Drive",
			htmlId: "antimatter_drive",
			unlocked: true,
			count: 0,
			cost: { silver: 100 },
			resourcePerSecond: { antimatter: 0.5, plasma: -100, ice: -12000 },
		},
		comms: {
			name: "Astronomical Breakthrough",
			htmlId: "comm_astroBreakthrough",
			unlocked: true,
			count: 0,
			max: 1,
			cost: { metal: 600, ice: 600, meteorite: 60 },
		},
	};
	const navigation = {
		military: { unlocked: true },
		antimatter: { unlocked: true },
		comms: { unlocked: true },
	};
	const originalGet = state.context.document.getElementById;
	const visible = new Map(
		Object.values(entries).map((entry) => [`${entry.htmlId}_buy`, true]),
	);
	state.context.document.getElementById = (id) =>
		visible.has(id)
			? {
					classList: { contains: () => !visible.get(id) },
					style: {},
					parentElement: null,
				}
			: originalGet(id);
	state.context.Game.interstellar.getInterstellarData = (id) => navigation[id];
	const rocket = { built: true };
	state.context.Game.interstellar.rocket = { getRocketData: () => rocket };
	for (const [category, entry] of Object.entries(entries)) {
		const buy = () => {
			if (!state.monkey.hasResources(entry.cost, false)) return;
			for (const [resource, amount] of Object.entries(entry.cost))
				state.stock[resource] -= amount;
			entry.count++;
			state.purchases.push(category);
		};
		state.context.Game.interstellar[category] = {
			getShipData: () => entry,
			getMachineData: () => entry,
			updateCost() {},
			buildShip: buy,
			buildMachine: buy,
		};
	}
	return { ...state, entries, navigation, visible, rocket };
}

test("post-sphere progression builds a scout, one drive and Astronomical Breakthrough in order", () => {
	const state = interstellarHarness();
	state.monkey.workInterstellar();
	assert.deepEqual(state.purchases, ["military", "antimatter", "comms"]);
	assert.equal(state.monkey.budget.plasma, 1);
	assert.equal(state.monkey.budget.ice, 0);
	assert.match(state.monkey.interstellarPlan, /flight ready/);
	state.monkey.beginTick();
	state.monkey.workInterstellar();
	assert.equal(state.purchases.length, 3);
});

test("interstellar progression respects sphere, rocket, research navigation and native controls", () => {
	for (const blocker of ["sphere", "rocket", "nav", "entry", "button"]) {
		const state = interstellarHarness();
		if (blocker === "sphere") state.context.sphere = 0;
		if (blocker === "rocket") state.rocket.built = false;
		if (blocker === "nav") state.navigation.military.unlocked = false;
		if (blocker === "entry") state.entries.military.unlocked = false;
		if (blocker === "button") state.visible.set("milit_scout_buy", false);
		state.monkey.workInterstellar();
		assert.deepEqual(state.purchases, []);
	}
});

test("Alcubierre drive requires safe plasma and ice production and honors its toggle", () => {
	for (const blocker of ["plasma", "ice", "toggle"]) {
		const state = interstellarHarness();
		state.entries.military.count = 1;
		if (blocker === "plasma") state.monkey.budget.plasma = 100.99;
		if (blocker === "ice") state.monkey.budget.ice = 11999;
		if (blocker === "toggle") state.context.antimatterToggled = false;
		state.monkey.workInterstellar();
		assert.deepEqual(state.purchases, []);
		assert.equal(state.entries.antimatter.count, 0);
	}
});

test("Astronomical Breakthrough reserves its materials against ordinary purchases and Dyson", () => {
	const state = interstellarHarness({
		machines: [{ name: "miner", costs: { metal: 500 } }],
		stock: { metal: 600, ice: 500, meteorite: 60 },
	});
	state.entries.military.count = 1;
	state.entries.antimatter.count = 1;
	state.monkey.workInterstellar();
	assert.match(state.monkey.interstellarPlan, /Astronomical Breakthrough/);
	assert.equal(state.monkey.hasResources({ metal: 1 }), false);
	assert.equal(
		state.monkey.tryBuildProducer("metal", "miner").kind,
		state.monkey.status.UNAFFORDABLE,
	);
	state.monkey.buildDyson();
	assert.deepEqual(state.purchases, []);
	state.stock.ice = 600;
	state.monkey.beginTick();
	state.monkey.workInterstellar();
	assert.deepEqual(state.purchases, ["comms"]);
	assert.equal(state.monkey.interstellarSavings, null);
});

test("failed native interstellar purchases do not advance the plan or report success", () => {
	const state = interstellarHarness();
	state.context.Game.interstellar.military.buildShip = () => {};
	state.monkey.workInterstellar();
	assert.deepEqual(state.purchases, []);
	assert.equal(state.monkey.lastAction, null);
	assert.match(state.monkey.interstellarPlan, /did not complete/);
});

test("completed native Stargate bug repairs travel and military while unrelated failures still stop", () => {
	for (const completed of [true, false]) {
		let state;
		state = harness({
			globals: {
				buttonsHidden: [],
				stargateWonderPlasmaCost: 0,
				stargateWonderSiliconCost: 0,
				stargateWonderMeteoriteCost: 0,
			},
			actions: {
				rebuildStargate() {
					if (completed) state.context.buttonsHidden.push("rebuildStargate");
					throw vm.runInContext(
						'new TypeError("missing native entry")',
						state.context,
					);
				},
			},
		});
		const navigation = {
			travel: { unlocked: false },
			military: { unlocked: false },
		};
		state.context.Game.interstellar.getInterstellarData = (id) =>
			navigation[id];
		state.monkey.run();
		assert.equal(navigation.travel.unlocked, completed);
		assert.equal(navigation.military.unlocked, completed);
		assert.equal(state.monkey.enabled, completed);
		if (completed) assert.equal(navigation.travel.displayNeedsUpdate, true);
	}
});

test("normal ticks run interstellar progression before competing construction", () => {
	const state = interstellarHarness();
	state.monkey.run();
	assert.deepEqual(state.purchases.slice(0, 3), [
		"military",
		"antimatter",
		"comms",
	]);
	assert.deepEqual(state.canceled, []);
});

test("interstellar savings protect the first scout but yield to deficit recovery", () => {
	const state = interstellarHarness({
		rates: { metal: -1 },
		stock: { metal: 99 },
		machines: [{ name: "miner", costs: { metal: 10 } }],
	});
	state.monkey.workInterstellar();
	assert.equal(state.monkey.hasResources({ metal: 10 }), false);
	assert.equal(state.monkey.interstellarSavings.metal, 100);
	state.monkey.recoverProduction();
	assert.deepEqual(state.purchases, ["miner"]);
	assert.equal(state.monkey.interstellarSavings, null);
});

const solarDestinations = [
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
function solarHarness(options = {}) {
	let state;
	state = harness({
		technologies: { unlockSolarSystem: purchasedTech() },
		stock: { metal: 1200, gem: 900, oil: 1000, rocketFuel: 21870 },
		globals: {
			rocket: 0,
			rocketLaunched: false,
			explored: [],
			buttonsHidden: [],
			rocketFuelToggled: true,
		},
		...options,
	});
	const visible = new Map();
	for (const [name] of solarDestinations) {
		visible.set(
			name[0].toLowerCase() + name.slice(1),
			["Moon", "Venus", "Mars", "AsteroidBelt"].includes(name),
		);
		visible.set(`explore${name}`, true);
	}
	const original = state.context.document.getElementById;
	state.context.document.getElementById = (id) =>
		visible.has(id)
			? {
					classList: { contains: () => !visible.get(id) },
					style: {},
					parentElement: null,
				}
			: original(id);
	state.available.set("getRocket", true);
	state.available.set("launchRocket", true);
	state.context.getRocket = () => {
		state.context.rocket = 1;
		state.stock.metal -= 1200;
		state.stock.gem -= 900;
		state.stock.oil -= 1000;
		state.purchases.push("solarRocket");
	};
	state.context.launchRocket = () => {
		state.context.rocket = 0;
		state.context.rocketLaunched = true;
		state.stock.rocketFuel -= 20;
		state.purchases.push("launch");
	};
	state.context.explore = (name) => {
		state.stock.rocketFuel -= solarDestinations.find(([id]) => id === name)[1];
		state.context.buttonsHidden.push(`explore${name}`);
		state.context.explored.push(name[0].toLowerCase() + name.slice(1));
		visible.set(`explore${name}`, false);
		state.purchases.push(name);
		if (name === "AsteroidBelt")
			for (const id of [
				"wonderStation",
				"jupiter",
				"saturn",
				"pluto",
				"kuiperBelt",
			])
				visible.set(id, true);
		if (name === "KuiperBelt") visible.set("solCenter", true);
	};
	return { ...state, visible };
}

test("solar exploration builds and launches its own rocket and unlocks the whole system", () => {
	const state = solarHarness();
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, [
		"solarRocket",
		"launch",
		...solarDestinations.map(([name]) => name),
	]);
	assert.equal(state.stock.rocketFuel, 0);
	assert.match(state.monkey.explorationPlan, /exploration complete/);
	state.monkey.exploreSolarSystem();
	assert.equal(state.purchases.length, 12);
});

test("solar exploration waits at the next destination using live fuel balances", () => {
	const state = solarHarness({
		stock: { rocketFuel: 70 },
		globals: { rocketLaunched: true, explored: [], buttonsHidden: [] },
	});
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, ["Moon", "Venus"]);
	assert.equal(state.stock.rocketFuel, 0);
	assert.match(state.monkey.explorationPlan, /Mars: 80 rocket fuel/);
	state.stock.rocketFuel = 80;
	state.monkey.beginTick();
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, ["Moon", "Venus", "Mars"]);
});

test("solar exploration respects research, hidden navigation, and failed native actions", () => {
	const state = solarHarness();
	state.technologies.unlockSolarSystem.current = 0;
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, []);
	state.technologies.unlockSolarSystem.current = 1;
	state.available.set("getRocket", false);
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, []);
	state.available.set("getRocket", true);
	state.context.getRocket = () => {};
	state.monkey.exploreSolarSystem();
	assert.equal(state.context.rocketLaunched, false);
	state.context.rocketLaunched = true;
	for (const key of state.visible.keys()) state.visible.set(key, false);
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, []);
	state.visible.set("moon", true);
	state.visible.set("exploreMoon", true);
	state.context.explore = () => {};
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, []);
	assert.match(state.monkey.explorationPlan, /did not complete/);
});

test("exploration fuel production uses shared input budgets and honors the player toggle", () => {
	const state = solarHarness({
		stock: { rocketFuel: 0 },
		rates: { oil: 20, charcoal: 20 },
		globals: {
			rocketLaunched: true,
			explored: [],
			buttonsHidden: [],
			rocketFuelToggled: true,
		},
		machines: [{ name: "chemicalPlant", inputs: { oil: 20, charcoal: 20 } }],
	});
	state.monkey.exploreSolarSystem();
	assert.deepEqual(state.purchases, ["chemicalPlant"]);
	assert.equal(state.monkey.budget.oil, 0);
	assert.equal(state.monkey.budget.charcoal, 0);
	state.monkey.beginTick();
	state.context.rocketFuelToggled = false;
	state.monkey.exploreSolarSystem();
	assert.equal(state.purchases.length, 1);
	assert.match(state.monkey.explorationPlan, /production is disabled/);
	assert.equal(state.monkey.emcResources().includes("rocketFuel"), false);
});

test("main automation off and stale updates postpone exploration", () => {
	for (const blocker of ["off", "stale"]) {
		const state = solarHarness();
		if (blocker === "off") state.monkey.setEnabled(false);
		if (blocker === "stale")
			state.context.Game.lastFixedUpdate = Date.now() - 3000;
		state.monkey.run();
		assert.equal(state.purchases.includes("launch"), false);
	}
});

function batteryHarness(options = {}) {
	return harness({
		stock: { metal: 1000, gem: 1000, lunarite: 1000 },
		technologies: {
			unlockLabT4: purchasedTech(),
			unlockBatteries: purchasedTech(),
			unlockBatteriesT2: purchasedTech(),
		},
		...options,
	});
}

for (const [price, expected] of [
	[149, true],
	[150, true],
	[151, false],
]) {
	test(`battery lower tier at ${price} uses the inclusive half-price rule`, () => {
		const state = batteryHarness({
			stock: { metal: 200 },
			machines: [
				{ name: "batteryT2", costs: { metal: 300 } },
				{ name: "battery", costs: { metal: price } },
			],
		});
		state.monkey.buyBatteries();
		assert.deepEqual(state.purchases, expected ? ["battery"] : []);
		if (!expected)
			assert.match(
				state.monkey.buildingPlans.get("batteries"),
				/Saving for batteryT2/,
			);
	});
}

test("batteries require purchased tier research and visible controls", () => {
	for (const blocker of ["research", "control"]) {
		const state = batteryHarness({
			machines: [{ name: "battery", costs: { metal: 10 } }],
		});
		if (blocker === "research") state.technologies.unlockBatteries.current = 0;
		if (blocker === "control") state.available.set("getBattery", false);
		state.monkey.buyBatteries();
		assert.deepEqual(state.purchases, []);
	}
});

test("battery purchases include the T1 discount and preserve interstellar savings", () => {
	const state = batteryHarness({
		stock: { metal: 50 },
		globals: { T1Price: 0.5 },
		machines: [{ name: "battery", costs: { metal: 100 } }],
	});
	state.monkey.interstellarSavings = { metal: 1 };
	state.monkey.buyBatteries();
	assert.deepEqual(state.purchases, []);
	state.monkey.interstellarSavings = null;
	state.monkey.buyBatteries();
	assert.deepEqual(state.purchases, ["battery"]);
	assert.equal(state.monkey.producerCost("batteries", "battery").metal, 50);
});

test("native battery failures do not report success and each tier builds at most once per tick", () => {
	const state = batteryHarness({
		machines: [{ name: "battery", costs: { metal: 10 }, affordable: false }],
	});
	state.monkey.buyBatteries();
	assert.equal(state.monkey.lastAction, null);
	state.context.getBattery = () => {
		state.context.battery++;
		state.purchases.push("battery");
	};
	state.monkey.buyBatteries();
	state.monkey.buyBatteries();
	assert.deepEqual(state.purchases, ["battery"]);
});

test("visible Stargaze T5 batteries are purchased without fictitious science research", () => {
	const state = batteryHarness({
		machines: [{ name: "batteryT5", costs: { metal: 100 } }],
	});
	state.monkey.buyBatteries();
	assert.deepEqual(state.purchases, ["batteryT5"]);
});

test("normal automation buys batteries but recovery and the off toggle pause them", () => {
	for (const blocker of [null, "recovery", "off"]) {
		const state = batteryHarness({
			machines: [{ name: "battery", costs: { metal: 10 } }],
		});
		if (blocker === "recovery") state.rates.energy = -1;
		if (blocker === "off") state.monkey.setEnabled(false);
		state.monkey.run();
		assert.deepEqual(state.purchases, blocker ? [] : ["battery"]);
	}
});

test("15K T1 battery research and construction are allowed while saving for 50M T4 science", () => {
	const state = harness({
		stock: { science: 15000, metal: 1000 },
		technologies: {
			unlockLabT4: research(50000000),
			unlockBatteries: research(15000),
			unlockBatteriesT2: purchasedTech(),
		},
		machines: [
			{ name: "battery", costs: { metal: 100 } },
			{ name: "batteryT2", costs: { metal: 200 } },
		],
	});
	state.monkey.buyEarlyScience();
	state.monkey.buyBatteries();
	assert.deepEqual(state.purchases, ["unlockBatteries", "battery"]);
	assert.equal(state.technologies.unlockLabT4.current, 0);
	assert.equal(state.stock.science, 0);
});

test("production recovery still builds and launches the solar rocket and spends available exploration fuel", () => {
	const state = solarHarness();
	state.rates.energy = -100;
	state.monkey.run();
	assert.deepEqual(state.purchases, [
		"solarRocket",
		"launch",
		...solarDestinations.map(([name]) => name),
	]);
	assert.match(state.monkey.explorationPlan, /exploration complete/);
	assert.deepEqual(state.canceled, []);
});

test("recovery exploration waits for fuel without adding fuel producers", () => {
	const state = solarHarness({
		stock: { rocketFuel: 0 },
		rates: { energy: -100, oil: 100, charcoal: 100 },
		globals: {
			rocketLaunched: true,
			explored: [],
			buttonsHidden: [],
			rocketFuelToggled: true,
		},
		machines: [{ name: "chemicalPlant", inputs: { oil: 20, charcoal: 20 } }],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, []);
	assert.match(state.monkey.explorationPlan, /Waiting to explore Moon/);
	assert.match(
		state.monkey.explorationPlan,
		/fuel producers wait for production recovery/,
	);
	state.stock.rocketFuel = 20;
	state.monkey.run();
	assert.deepEqual(state.purchases, ["Moon"]);
});

test("zero-power item producers build during energy recovery despite expensive lower tiers", () => {
	const state = harness({
		rates: { energy: -100 },
		stock: { metal: 1000 },
		machines: [
			{ name: "heavyDrill", costs: { metal: 100 }, inputs: { energy: 10 } },
			{ name: "miner", costs: { metal: 90 } },
			{ name: "woodcutter" },
		],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["miner", "woodcutter"]);
	assert.equal(state.monkey.budget.energy, -100);
	assert.equal(state.monkey.buildingPlans.has("metal"), false);
});

test("zero-power producers can consume safely budgeted non-energy inputs", () => {
	const state = harness({
		rates: { energy: -1, wood: 10 },
		machines: [{ name: "woodburner", inputs: { wood: 10 } }],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["woodburner"]);
	assert.equal(state.monkey.budget.wood, 0);
	state.monkey.beginTick();
	state.monkey.budget.wood = 9;
	state.monkey.buildZeroPowerProducers();
	assert.equal(state.purchases.length, 1);
});

test("normal powered ticks also buy zero-power lower tiers once per tick", () => {
	const state = harness({
		rates: { energy: 100000 },
		stock: { energy: 100000, metal: 1000 },
		machines: [
			{
				name: "heavyDrill",
				costs: { metal: 100 },
				inputs: { energy: 10 },
				affordable: false,
			},
			{ name: "miner", costs: { metal: 90 } },
		],
	});
	state.monkey.run();
	assert.deepEqual(state.purchases, ["miner"]);
});

test("zero-power passes still respect unlocks, full storage, toggles and reserved materials", () => {
	for (const blocker of ["locked", "full", "toggle", "reserved"]) {
		const state = harness({
			stock: { metal: 100 },
			machines: [
				{ name: "miner", costs: { metal: 100 }, locked: blocker === "locked" },
				{ name: "woodburner" },
			],
		});
		state.context.charcoalToggled = false;
		if (blocker === "full") state.stock.metal = 100000;
		if (blocker === "toggle") state.context.globalEnergyLock = true;
		if (blocker === "reserved") state.monkey.interstellarSavings = { metal: 1 };
		state.monkey.buildZeroPowerProducers();
		// A global energy lock blocks only powered producers.
		assert.deepEqual(state.purchases, blocker === "toggle" ? ["miner"] : []);
	}
});
