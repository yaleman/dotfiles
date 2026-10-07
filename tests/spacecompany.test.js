const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../spacecompany.js"), "utf8");

function harness(production, machines) {
	const messages = [];
	const purchases = [];
	const context = vm.createContext({
		RESOURCE: { Energy: "energy", Wood: "wood", Charcoal: "charcoal", Hydrogen: "hydrogen", Plasma: "plasma", Meteorite: "meteorite" },
		Game: {
			resources: { getProduction: (resource) => production[resource] ?? 0, getStorage: () => 100 },
			tech: { getTechData: () => ({ current: 0 }) },
		},
		document: {
			getElementById: () => null,
			querySelectorAll: (selector) => {
				const machine = machines.find((item) => selector.includes(`get${item.name[0].toUpperCase()}${item.name.slice(1)}()`));
				return machine ? [{ classList: { contains: () => machine.locked ?? false }, style: {}, parentElement: null }] : [];
			},
		},
		console: { debug() {}, error() {} },
		setInterval: () => 1,
		clearInterval() {},
		charcoalToggled: true,
		heaterToggled: true,
		meteoriteToggled: true,
		meteorite: 0,
	});
	context.window = context;
	for (const machine of machines) {
		context[machine.name] = 0;
		for (const [resource, amount] of Object.entries(machine.inputs ?? {})) {
			context[`${machine.name}${resource[0].toUpperCase()}${resource.slice(1)}Input`] = amount;
		}
		context[`get${machine.name[0].toUpperCase()}${machine.name.slice(1)}`] = () => {
			if (machine.affordable === false) return;
			context[machine.name]++;
			purchases.push(machine.name);
		};
	}
	vm.runInContext(source, context);
	context.automonkey.setMessage = (text) => messages.push(text);
	return { context, monkey: context.automonkey, messages, purchases };
}

test("negative production preempts normal purchases even with full storage", () => {
	const { monkey, purchases, messages } = harness({ wood: -5 }, [{ name: "woodcutter" }]);
	monkey.maxedOut = () => true;
	monkey.run(); // Normal execution would access unstubbed Dyson globals and fail.
	assert.deepEqual(purchases, ["woodcutter"]);
	assert.match(messages.at(-1), /Recovering wood: -5\/s/);
});

test("buys only one producer per tick and stops recovery at zero", () => {
	const production = { wood: -5, energy: -2 };
	const { monkey, purchases } = harness(production, [{ name: "woodcutter" }, { name: "solarPanel" }]);
	assert.equal(monkey.recoverProduction(), true);
	assert.equal(purchases.length, 1);
	production.wood = 0;
	production.energy = 0;
	assert.equal(monkey.recoverProduction(), false);
	assert.equal(purchases.length, 1);
});

test("rejects producers that worsen an existing deficit or create a new one", () => {
	for (const energy of [-1, 0, 9]) {
		const { monkey, purchases } = harness({ wood: -5, energy }, [
			{ name: "laserCutter", inputs: { energy: 10 } }, { name: "woodcutter" },
		]);
		monkey.recoverProduction();
		assert.deepEqual(purchases, ["woodcutter"]);
	}
});

test("allows sufficient input production with the energy efficiency discount", () => {
	const { context, monkey, purchases } = harness({ wood: -5, energy: 5 }, [
		{ name: "laserCutter", inputs: { energy: 10 } },
	]);
	context.Game.tech.getTechData = () => ({ current: 50 });
	monkey.recoverProduction();
	assert.deepEqual(purchases, ["laserCutter"]);
});

test("falls back from locked or unaffordable producers", () => {
	const { monkey, purchases } = harness({ wood: -5, energy: 100 }, [
		{ name: "infuser", locked: true }, { name: "deforester", affordable: false }, { name: "woodcutter" },
	]);
	monkey.recoverProduction();
	assert.deepEqual(purchases, ["woodcutter"]);
});

test("waits without normal purchases when recovery is blocked", () => {
	const { monkey, messages, purchases } = harness({ charcoal: -1, wood: -1 }, [
		{ name: "woodburner", inputs: { wood: 2 } },
	]);
	monkey.run();
	assert.deepEqual(purchases, []);
	assert.match(messages.at(-1), /waiting/);
});

test("does not buy switched-off or power-starved producers", () => {
	const { context, monkey, purchases } = harness({ charcoal: -1, wood: 10, energy: 20 }, [
		{ name: "furnace", inputs: { wood: 2, energy: 10 } },
	]);
	context.charcoalToggled = false;
	monkey.recoverProduction();
	context.charcoalToggled = true;
	context.energyLow = true;
	monkey.recoverProduction();
	assert.deepEqual(purchases, []);
});

test("starts zero plasma production with one Super-Heater and stops buying more", () => {
	const { monkey, purchases, messages } = harness({ energy: 1000, hydrogen: 10 }, [
		{ name: "heater", inputs: { energy: 1000, hydrogen: 10 } },
	]);
	monkey.run();
	assert.deepEqual(purchases, ["heater"]);
	assert.match(messages.at(-1), /Super-Heater/);
	assert.equal(monkey.ensurePlasmaProduction(), false);
	assert.deepEqual(purchases, ["heater"]);
});

test("does not bootstrap plasma when production already exists", () => {
	const { monkey, purchases } = harness({ plasma: 1, energy: 1000, hydrogen: 10 }, [{ name: "heater" }]);
	assert.equal(monkey.ensurePlasmaProduction(), false);
	assert.deepEqual(purchases, []);
});

test("plasma bootstrap respects input production, unlocks, toggles and affordability", () => {
	for (const options of [
		{ production: { energy: 999, hydrogen: 10 } },
		{ production: { energy: 1000, hydrogen: 9 } },
		{ locked: true },
		{ affordable: false },
		{ toggled: false },
	]) {
		const { context, monkey, purchases } = harness(options.production ?? { energy: 1000, hydrogen: 10 }, [
			{ name: "heater", inputs: { energy: 1000, hydrogen: 10 }, ...options },
		]);
		context.heaterToggled = options.toggled ?? true;
		assert.equal(monkey.ensurePlasmaProduction(), false);
		assert.deepEqual(purchases, []);
	}
});

test("resource deficit recovery takes priority over starting plasma", () => {
	const { monkey, purchases } = harness({ wood: -1, energy: 1000, hydrogen: 10 }, [
		{ name: "woodcutter" }, { name: "heater", inputs: { energy: 1000, hydrogen: 10 } },
	]);
	monkey.run();
	assert.deepEqual(purchases, ["woodcutter"]);
});

function researchHarness(science, technologies) {
	const state = harness({ plasma: 1 }, []);
	const researchPurchases = [];
	state.context.Game.tech.getTechData = (id) => id === "energyEfficiencyResearch" ? { current: 0 } : technologies[id];
	state.context.Game.tech.hasResources = (cost) => science >= cost.science;
	state.context.purchaseTech = (id) => {
		science -= technologies[id].cost.science;
		technologies[id].current++;
		researchPurchases.push(id);
	};
	return { ...state, researchPurchases };
}

test("unlocks affordable EMC and Dyson research before normal spending", () => {
	const { monkey, researchPurchases } = researchHarness(160000, {
		unlockEmc: { name: "Energy-Mass Conversion", unlocked: true, current: 0, cost: { science: 60000 } },
		unlockDyson: { name: "Dyson Ring", unlocked: true, current: 0, cost: { science: 100000 } },
	});
	monkey.run();
	assert.deepEqual(researchPurchases, ["unlockEmc", "unlockDyson"]);
	assert.equal(monkey.unlockProgressionResearch(), false);
});

test("skips locked and already purchased progression research", () => {
	const { monkey, researchPurchases } = researchHarness(1000000, {
		unlockEmc: { unlocked: false, current: 0, cost: { science: 60000 } },
		unlockDyson: { unlocked: true, current: 1, cost: { science: 100000 } },
	});
	assert.equal(monkey.unlockProgressionResearch(), false);
	assert.deepEqual(researchPurchases, []);
});

test("rechecks affordability after each research purchase", () => {
	const { monkey, researchPurchases } = researchHarness(100000, {
		unlockEmc: { unlocked: true, current: 0, cost: { science: 60000 } },
		unlockDyson: { unlocked: true, current: 0, cost: { science: 100000 } },
	});
	assert.equal(monkey.unlockProgressionResearch(), true);
	assert.deepEqual(researchPurchases, ["unlockEmc"]);
});

function meteoriteHarness(plasma, technologies = { unlockEmc: { current: 1 }, unlockDyson: { current: 1 } }) {
	const state = harness({ plasma }, [
		{ name: "web", inputs: { plasma: 21 } },
		{ name: "printer", inputs: { plasma: 3 } },
	]);
	state.context.Game.tech.getTechData = (id) => id === "energyEfficiencyResearch" ? { current: 0 } : technologies[id];
	return state;
}

test("meteorite production requires both EMC and Dyson research", () => {
	for (const missing of ["unlockEmc", "unlockDyson"]) {
		const technologies = { unlockEmc: { current: 1 }, unlockDyson: { current: 1 } };
		technologies[missing].current = 0;
		const { monkey, purchases } = meteoriteHarness(100, technologies);
		assert.equal(monkey.buildMeteoriteProduction(), false);
		assert.deepEqual(purchases, []);
	}
});

test("meteorite purchases preserve one full plasma per second", () => {
	for (const [plasma, expected] of [[3, []], [3.99, []], [4, ["printer"]], [21.99, ["printer"]], [22, ["web"]]]) {
		const { monkey, purchases } = meteoriteHarness(plasma);
		monkey.buildMeteoriteProduction();
		assert.deepEqual(purchases, expected);
	}
});

test("meteorite recovery also preserves the plasma reserve", () => {
	const { monkey } = meteoriteHarness(3.99);
	assert.equal(monkey.tryBuildProducer("meteorite", "printer"), false);
});

test("does not buy meteorite producers at full storage or when disabled", () => {
	const { context, monkey, purchases } = meteoriteHarness(100);
	context.meteorite = 100;
	assert.equal(monkey.buildMeteoriteProduction(), false);
	context.meteorite = 0;
	context.meteoriteToggled = false;
	assert.equal(monkey.buildMeteoriteProduction(), false);
	assert.deepEqual(purchases, []);
});

test("unlocks meteorite production research only after EMC and Dyson", () => {
	const technologies = {
		unlockEmc: { current: 1 }, unlockDyson: { current: 0 },
		unlockMeteorite: { unlocked: true, current: 0, cost: { science: 100000 } },
		unlockMeteoriteTier1: { unlocked: true, current: 0, cost: { science: 75000 } },
		unlockMeteoriteTier2: { unlocked: true, current: 0, cost: { science: 100000 } },
	};
	const { monkey, researchPurchases } = researchHarness(275000, technologies);
	assert.equal(monkey.unlockProgressionResearch(), false);
	technologies.unlockDyson.current = 1;
	assert.equal(monkey.unlockProgressionResearch(), true);
	assert.deepEqual(researchPurchases, ["unlockMeteorite", "unlockMeteoriteTier1", "unlockMeteoriteTier2"]);
});
