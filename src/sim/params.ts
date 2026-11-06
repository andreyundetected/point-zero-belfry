// Стартовые цифры симуляции (спека §8, подгоняются тестами sim:cascade / sim:solve).
export const P = {
  tau: 220,           // постоянная времени подачи, с (при полном вентиле)
  bleed: 0.05 / 60,   // бар/с при полном открытии стравливания
  rated: 2.0,         // номинал стыка кухни
  kLeak: 7,         // %/с × бар^pow превышения над номиналом
  kLeakPow: 4,
  ventBase: 0.0008, ventHood: 0.002, ventWin: 0.002, ventDoor: 0.001,
  diffSK: 0.020, diffKH: 0.012,
  smell: 0.5, ignite: 5.0, alarmGas: 2.5,
  matveySpeed: 0.62, lampWalk: 150, waitStep: 150, deadline: 2310,
  tildaRest: 110, tildaStamina: 14, tildaSpeed: 0.5,
  tramSpeed: 3, tramDwell: 40, boardWindow: 70,
  dockSpeed: 0.19, dockDecide: 1320,
  fireSpread: { hall: 50, upper: 130, cellar: 170 },
  sealedFirstJump: true, windowSpin: 30,
};
