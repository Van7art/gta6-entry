// missions-data.js — the story of Porto Verde: eight chained jobs for Lena
// Cross, from a first delivery to taking Dante Ferreira's empire. Data only;
// the engine that runs these steps lives in missions.js.
import { ECONOMY } from './config.js';

export const STORY_INTRO =
  'Porto Verde, 6:47 PM. Jax Moreno is back after five years away — his brother\'s ' +
  'garage burned down, the debt collectors are circling, and the only person who ' +
  'still answers his calls is Lena Cross, who runs Cross Motors and knows every ' +
  'street in the city. Dante Ferreira owns the casinos, the docks and half the ' +
  'cops. Jax is going to take it all back, one job at a time.';

export const MISSIONS = [
  {
    id: 'first-gear', title: '1 · First Gear', reward: ECONOMY.missionRewards[0],
    briefing: 'LENA: "Jax, you\'re back. My coupe is parked up the street — bring it to Cross Motors. Drive like you remember how."',
    steps: [
      { type: 'goto', x: 0, z: 66, label: 'Get to Lena\'s coupe' },
      { type: 'enterVehicle', carId: 'lena-coupe', label: 'Get in the coupe' },
      { type: 'driveTo', x: -90, z: 74, label: 'Drive to Cross Motors', radius: 10 },
    ],
  },
  {
    id: 'fare-game', title: '2 · Fare Game', reward: ECONOMY.missionRewards[1],
    briefing: 'LENA: "The taxi game pays cash every night. Three fares, all over town. Don\'t keep them waiting — and don\'t wreck my cab."',
    timeLimit: 300,
    steps: [
      { type: 'enterVehicle', carId: 'taxi', label: 'Get in the taxi' },
      { type: 'pickup', x: 240, z: -60, label: 'Pick up the fare on Playa Dorada' },
      { type: 'deliver', x: 0, z: -180, label: 'Drop the fare Downtown' },
      { type: 'pickup', x: 60, z: 240, label: 'Pick up the fare at the Docks' },
      { type: 'deliver', x: -180, z: 60, label: 'Drop the fare in Barrio Viejo' },
      { type: 'pickup', x: 120, z: 120, label: 'Pick up the fare in Midtown' },
      { type: 'deliver', x: -90, z: 74, label: 'Drop the fare at Cross Motors' },
    ],
  },
  {
    id: 'dockside-dash', title: '3 · Dockside Dash', reward: ECONOMY.missionRewards[2],
    briefing: 'LENA: "Ferreira\'s boys left a box truck at the docks, full of casino chips. Take it. They\'ll shoot — shoot back or drive fast."',
    steps: [
      { type: 'goto', x: 60, z: 258, label: 'Get to the docks' },
      { type: 'enterVehicle', carId: 'dock-truck', label: 'Steal the box truck', guards: 2, wantedOnEnter: 2 },
      { type: 'driveTo', x: -90, z: 74, label: 'Lose the heat — deliver the truck to Cross Motors', radius: 10 },
    ],
  },
  {
    id: 'street-king', title: '4 · Street King', reward: ECONOMY.missionRewards[3],
    briefing: 'LENA: "Tonight\'s street race decides who owns the night roads. Two rivals, eight gates. Beat them and the whole city will know your name."',
    timeLimit: 180,
    steps: [
      { type: 'goto', x: 0, z: -240, label: 'Get to the start line, North Road' },
      {
        type: 'race', label: 'Race! Hit all 8 gates before your rivals',
        checkpoints: [
          { x: 0, z: -240 }, { x: 240, z: -240 }, { x: 240, z: 0 }, { x: 240, z: 240 },
          { x: 0, z: 240 }, { x: -240, z: 240 }, { x: -240, z: 0 }, { x: -240, z: -240 },
        ],
      },
    ],
  },
  {
    id: 'beach-run', title: '5 · Beach Run', reward: ECONOMY.missionRewards[4],
    briefing: 'LENA: "A package is waiting on the beach. Ferreira\'s cops will be all over you the second you grab it. Two minutes, downtown. Go."',
    timeLimit: 150,
    steps: [
      { type: 'goto', x: 305, z: 120, label: 'Grab the package on the beach', wantedOnStart: 3 },
      { type: 'deliver', x: 0, z: -180, label: 'Deliver downtown — the heat is on!', radius: 12 },
    ],
  },
  {
    id: 'ferreira-job', title: '6 · The Ferreira Job', reward: ECONOMY.missionRewards[5],
    briefing: 'LENA: "This is it. Ferreira\'s gold supercar is in his downtown garage. Take it, outrun everything, and bring it home. After this, Porto Verde is ours."',
    steps: [
      { type: 'goto', x: 60, z: -180, label: 'Get to Ferreira\'s downtown garage' },
      { type: 'enterVehicle', carId: 'gold-car', label: 'Steal the gold supercar', guards: 3, wantedOnEnter: 4 },
      { type: 'driveTo', x: -90, z: 74, label: 'Bring the gold car home to Cross Motors', radius: 10 },
    ],
  },
  {
    id: 'harbour-heist', title: '7 · Harbour Heist', reward: ECONOMY.missionRewards[6],
    briefing: 'LENA: "Ferreira\'s ledger is in the dock warehouse — every bribe, every name. His crew is guarding it. Clear them out on foot, take the van, and don\'t stop for anyone."',
    steps: [
      { type: 'goto', x: 60, z: 240, label: 'Get to the dock warehouse' },
      { type: 'clearOut', x: 60, z: 264, guards: 4, label: 'Clear out Ferreira\'s crew' },
      { type: 'enterVehicle', carId: 'ledger-van', label: 'Take the ledger van', wantedOnEnter: 3 },
      { type: 'driveTo', x: -90, z: 74, label: 'Bring the ledger to Cross Motors', radius: 10 },
    ],
  },
  {
    id: 'kingpins-fall', title: '8 · Kingpin\'s Fall', reward: ECONOMY.missionRewards[7],
    briefing: 'LENA: "The ledger names every cop Ferreira owns — and tonight his convoy moves the casino cash through Downtown. Three escorts, ten gates, four stars of heat. End this."',
    timeLimit: 240,
    steps: [
      { type: 'goto', x: 0, z: -180, label: 'Get to Ferreira\'s convoy', wantedOnStart: 4 },
      {
        type: 'race', rivals: 3, label: 'Chase the convoy! Hit all 10 gates before the escorts',
        checkpoints: [
          { x: 0, z: -180 }, { x: 180, z: -180 }, { x: 180, z: 0 }, { x: 180, z: 180 },
          { x: 0, z: 180 }, { x: -180, z: 180 }, { x: -180, z: 0 }, { x: -180, z: -180 },
          { x: 0, z: -60 }, { x: 0, z: -180 },
        ],
      },
    ],
  },
];

export const MISSION_CARS = {
  'lena-coupe': { type: 'sports', x: 0, z: 63.5, heading: 0, color: 0xd94f30 },
  'taxi': { type: 'taxi', x: -90, z: 74, heading: Math.PI / 2, color: 0xf7c600 },
  'dock-truck': { type: 'truck', x: 60, z: 270, heading: Math.PI, color: 0x2471a3 },
  'gold-car': { type: 'sports', x: 60, z: -176, heading: Math.PI, color: 0xf7c600 },
  'ledger-van': { type: 'van', x: 84, z: 270, heading: Math.PI, color: 0x8e44ad },
};
