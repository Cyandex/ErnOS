/**
 * Periodic Table — Bundled element data for chemistry lookups.
 *
 * 118 elements with: symbol, name, atomic number, atomic mass,
 * category, electron configuration, and common properties.
 */

export interface Element {
  number: number;
  symbol: string;
  name: string;
  mass: number;
  category: string;
  electronConfig: string;
  electronegativity?: number;
  meltingPoint?: number; // Kelvin
  boilingPoint?: number; // Kelvin
  density?: number; // g/cm³
}

// Comprehensive periodic table (first 36 elements shown in full,
// remaining 82 as compact entries — all 118 are present)
const ELEMENTS: Element[] = [
  { number: 1, symbol: "H", name: "Hydrogen", mass: 1.008, category: "nonmetal", electronConfig: "1s1", electronegativity: 2.20, meltingPoint: 14.01, boilingPoint: 20.28, density: 0.00009 },
  { number: 2, symbol: "He", name: "Helium", mass: 4.003, category: "noble gas", electronConfig: "1s2", meltingPoint: 0.95, boilingPoint: 4.22, density: 0.000164 },
  { number: 3, symbol: "Li", name: "Lithium", mass: 6.941, category: "alkali metal", electronConfig: "[He] 2s1", electronegativity: 0.98, meltingPoint: 453.65, boilingPoint: 1615, density: 0.534 },
  { number: 4, symbol: "Be", name: "Beryllium", mass: 9.012, category: "alkaline earth", electronConfig: "[He] 2s2", electronegativity: 1.57, meltingPoint: 1560, boilingPoint: 2744, density: 1.85 },
  { number: 5, symbol: "B", name: "Boron", mass: 10.81, category: "metalloid", electronConfig: "[He] 2s2 2p1", electronegativity: 2.04, meltingPoint: 2349, boilingPoint: 4200, density: 2.34 },
  { number: 6, symbol: "C", name: "Carbon", mass: 12.011, category: "nonmetal", electronConfig: "[He] 2s2 2p2", electronegativity: 2.55, meltingPoint: 3823, boilingPoint: 4098, density: 2.267 },
  { number: 7, symbol: "N", name: "Nitrogen", mass: 14.007, category: "nonmetal", electronConfig: "[He] 2s2 2p3", electronegativity: 3.04, meltingPoint: 63.15, boilingPoint: 77.36, density: 0.0012506 },
  { number: 8, symbol: "O", name: "Oxygen", mass: 15.999, category: "nonmetal", electronConfig: "[He] 2s2 2p4", electronegativity: 3.44, meltingPoint: 54.36, boilingPoint: 90.20, density: 0.001429 },
  { number: 9, symbol: "F", name: "Fluorine", mass: 18.998, category: "halogen", electronConfig: "[He] 2s2 2p5", electronegativity: 3.98, meltingPoint: 53.53, boilingPoint: 85.03, density: 0.001696 },
  { number: 10, symbol: "Ne", name: "Neon", mass: 20.180, category: "noble gas", electronConfig: "[He] 2s2 2p6", meltingPoint: 24.56, boilingPoint: 27.07, density: 0.0008999 },
  { number: 11, symbol: "Na", name: "Sodium", mass: 22.990, category: "alkali metal", electronConfig: "[Ne] 3s1", electronegativity: 0.93, meltingPoint: 370.87, boilingPoint: 1156, density: 0.971 },
  { number: 12, symbol: "Mg", name: "Magnesium", mass: 24.305, category: "alkaline earth", electronConfig: "[Ne] 3s2", electronegativity: 1.31, meltingPoint: 923, boilingPoint: 1363, density: 1.738 },
  { number: 13, symbol: "Al", name: "Aluminium", mass: 26.982, category: "post-transition metal", electronConfig: "[Ne] 3s2 3p1", electronegativity: 1.61, meltingPoint: 933.47, boilingPoint: 2792, density: 2.698 },
  { number: 14, symbol: "Si", name: "Silicon", mass: 28.086, category: "metalloid", electronConfig: "[Ne] 3s2 3p2", electronegativity: 1.90, meltingPoint: 1687, boilingPoint: 3538, density: 2.3296 },
  { number: 15, symbol: "P", name: "Phosphorus", mass: 30.974, category: "nonmetal", electronConfig: "[Ne] 3s2 3p3", electronegativity: 2.19, meltingPoint: 317.30, boilingPoint: 553.65, density: 1.82 },
  { number: 16, symbol: "S", name: "Sulfur", mass: 32.06, category: "nonmetal", electronConfig: "[Ne] 3s2 3p4", electronegativity: 2.58, meltingPoint: 388.36, boilingPoint: 717.76, density: 2.067 },
  { number: 17, symbol: "Cl", name: "Chlorine", mass: 35.45, category: "halogen", electronConfig: "[Ne] 3s2 3p5", electronegativity: 3.16, meltingPoint: 171.65, boilingPoint: 239.11, density: 0.003214 },
  { number: 18, symbol: "Ar", name: "Argon", mass: 39.948, category: "noble gas", electronConfig: "[Ne] 3s2 3p6", meltingPoint: 83.80, boilingPoint: 87.30, density: 0.0017837 },
  { number: 19, symbol: "K", name: "Potassium", mass: 39.098, category: "alkali metal", electronConfig: "[Ar] 4s1", electronegativity: 0.82, meltingPoint: 336.53, boilingPoint: 1032, density: 0.862 },
  { number: 20, symbol: "Ca", name: "Calcium", mass: 40.078, category: "alkaline earth", electronConfig: "[Ar] 4s2", electronegativity: 1.00, meltingPoint: 1115, boilingPoint: 1757, density: 1.55 },
  { number: 21, symbol: "Sc", name: "Scandium", mass: 44.956, category: "transition metal", electronConfig: "[Ar] 3d1 4s2", electronegativity: 1.36, meltingPoint: 1814, boilingPoint: 3109, density: 2.989 },
  { number: 22, symbol: "Ti", name: "Titanium", mass: 47.867, category: "transition metal", electronConfig: "[Ar] 3d2 4s2", electronegativity: 1.54, meltingPoint: 1941, boilingPoint: 3560, density: 4.54 },
  { number: 23, symbol: "V", name: "Vanadium", mass: 50.942, category: "transition metal", electronConfig: "[Ar] 3d3 4s2", electronegativity: 1.63, meltingPoint: 2183, boilingPoint: 3680, density: 6.11 },
  { number: 24, symbol: "Cr", name: "Chromium", mass: 51.996, category: "transition metal", electronConfig: "[Ar] 3d5 4s1", electronegativity: 1.66, meltingPoint: 2180, boilingPoint: 2944, density: 7.15 },
  { number: 25, symbol: "Mn", name: "Manganese", mass: 54.938, category: "transition metal", electronConfig: "[Ar] 3d5 4s2", electronegativity: 1.55, meltingPoint: 1519, boilingPoint: 2334, density: 7.44 },
  { number: 26, symbol: "Fe", name: "Iron", mass: 55.845, category: "transition metal", electronConfig: "[Ar] 3d6 4s2", electronegativity: 1.83, meltingPoint: 1811, boilingPoint: 3134, density: 7.874 },
  { number: 27, symbol: "Co", name: "Cobalt", mass: 58.933, category: "transition metal", electronConfig: "[Ar] 3d7 4s2", electronegativity: 1.88, meltingPoint: 1768, boilingPoint: 3200, density: 8.90 },
  { number: 28, symbol: "Ni", name: "Nickel", mass: 58.693, category: "transition metal", electronConfig: "[Ar] 3d8 4s2", electronegativity: 1.91, meltingPoint: 1728, boilingPoint: 3186, density: 8.912 },
  { number: 29, symbol: "Cu", name: "Copper", mass: 63.546, category: "transition metal", electronConfig: "[Ar] 3d10 4s1", electronegativity: 1.90, meltingPoint: 1357.77, boilingPoint: 2835, density: 8.96 },
  { number: 30, symbol: "Zn", name: "Zinc", mass: 65.38, category: "transition metal", electronConfig: "[Ar] 3d10 4s2", electronegativity: 1.65, meltingPoint: 692.68, boilingPoint: 1180, density: 7.134 },
  { number: 31, symbol: "Ga", name: "Gallium", mass: 69.723, category: "post-transition metal", electronConfig: "[Ar] 3d10 4s2 4p1", electronegativity: 1.81, meltingPoint: 302.91, boilingPoint: 2477, density: 5.907 },
  { number: 32, symbol: "Ge", name: "Germanium", mass: 72.630, category: "metalloid", electronConfig: "[Ar] 3d10 4s2 4p2", electronegativity: 2.01, meltingPoint: 1211.40, boilingPoint: 3106, density: 5.323 },
  { number: 33, symbol: "As", name: "Arsenic", mass: 74.922, category: "metalloid", electronConfig: "[Ar] 3d10 4s2 4p3", electronegativity: 2.18, meltingPoint: 1090, boilingPoint: 887, density: 5.776 },
  { number: 34, symbol: "Se", name: "Selenium", mass: 78.971, category: "nonmetal", electronConfig: "[Ar] 3d10 4s2 4p4", electronegativity: 2.55, meltingPoint: 494, boilingPoint: 958, density: 4.809 },
  { number: 35, symbol: "Br", name: "Bromine", mass: 79.904, category: "halogen", electronConfig: "[Ar] 3d10 4s2 4p5", electronegativity: 2.96, meltingPoint: 265.95, boilingPoint: 332.0, density: 3.122 },
  { number: 36, symbol: "Kr", name: "Krypton", mass: 83.798, category: "noble gas", electronConfig: "[Ar] 3d10 4s2 4p6", meltingPoint: 115.79, boilingPoint: 119.93, density: 0.003733 },
  // Period 5
  { number: 37, symbol: "Rb", name: "Rubidium", mass: 85.468, category: "alkali metal", electronConfig: "[Kr] 5s1", electronegativity: 0.82 },
  { number: 38, symbol: "Sr", name: "Strontium", mass: 87.62, category: "alkaline earth", electronConfig: "[Kr] 5s2", electronegativity: 0.95 },
  { number: 39, symbol: "Y", name: "Yttrium", mass: 88.906, category: "transition metal", electronConfig: "[Kr] 4d1 5s2", electronegativity: 1.22 },
  { number: 40, symbol: "Zr", name: "Zirconium", mass: 91.224, category: "transition metal", electronConfig: "[Kr] 4d2 5s2", electronegativity: 1.33 },
  { number: 41, symbol: "Nb", name: "Niobium", mass: 92.906, category: "transition metal", electronConfig: "[Kr] 4d4 5s1", electronegativity: 1.6 },
  { number: 42, symbol: "Mo", name: "Molybdenum", mass: 95.95, category: "transition metal", electronConfig: "[Kr] 4d5 5s1", electronegativity: 2.16 },
  { number: 43, symbol: "Tc", name: "Technetium", mass: 98, category: "transition metal", electronConfig: "[Kr] 4d5 5s2", electronegativity: 1.9 },
  { number: 44, symbol: "Ru", name: "Ruthenium", mass: 101.07, category: "transition metal", electronConfig: "[Kr] 4d7 5s1", electronegativity: 2.2 },
  { number: 45, symbol: "Rh", name: "Rhodium", mass: 102.91, category: "transition metal", electronConfig: "[Kr] 4d8 5s1", electronegativity: 2.28 },
  { number: 46, symbol: "Pd", name: "Palladium", mass: 106.42, category: "transition metal", electronConfig: "[Kr] 4d10", electronegativity: 2.20 },
  { number: 47, symbol: "Ag", name: "Silver", mass: 107.87, category: "transition metal", electronConfig: "[Kr] 4d10 5s1", electronegativity: 1.93 },
  { number: 48, symbol: "Cd", name: "Cadmium", mass: 112.41, category: "transition metal", electronConfig: "[Kr] 4d10 5s2", electronegativity: 1.69 },
  { number: 49, symbol: "In", name: "Indium", mass: 114.82, category: "post-transition metal", electronConfig: "[Kr] 4d10 5s2 5p1", electronegativity: 1.78 },
  { number: 50, symbol: "Sn", name: "Tin", mass: 118.71, category: "post-transition metal", electronConfig: "[Kr] 4d10 5s2 5p2", electronegativity: 1.96 },
  { number: 51, symbol: "Sb", name: "Antimony", mass: 121.76, category: "metalloid", electronConfig: "[Kr] 4d10 5s2 5p3", electronegativity: 2.05 },
  { number: 52, symbol: "Te", name: "Tellurium", mass: 127.60, category: "metalloid", electronConfig: "[Kr] 4d10 5s2 5p4", electronegativity: 2.1 },
  { number: 53, symbol: "I", name: "Iodine", mass: 126.90, category: "halogen", electronConfig: "[Kr] 4d10 5s2 5p5", electronegativity: 2.66 },
  { number: 54, symbol: "Xe", name: "Xenon", mass: 131.29, category: "noble gas", electronConfig: "[Kr] 4d10 5s2 5p6" },
  // Period 6
  { number: 55, symbol: "Cs", name: "Caesium", mass: 132.91, category: "alkali metal", electronConfig: "[Xe] 6s1", electronegativity: 0.79 },
  { number: 56, symbol: "Ba", name: "Barium", mass: 137.33, category: "alkaline earth", electronConfig: "[Xe] 6s2", electronegativity: 0.89 },
  { number: 57, symbol: "La", name: "Lanthanum", mass: 138.91, category: "lanthanide", electronConfig: "[Xe] 5d1 6s2", electronegativity: 1.10 },
  { number: 58, symbol: "Ce", name: "Cerium", mass: 140.12, category: "lanthanide", electronConfig: "[Xe] 4f1 5d1 6s2", electronegativity: 1.12 },
  { number: 59, symbol: "Pr", name: "Praseodymium", mass: 140.91, category: "lanthanide", electronConfig: "[Xe] 4f3 6s2", electronegativity: 1.13 },
  { number: 60, symbol: "Nd", name: "Neodymium", mass: 144.24, category: "lanthanide", electronConfig: "[Xe] 4f4 6s2", electronegativity: 1.14 },
  { number: 61, symbol: "Pm", name: "Promethium", mass: 145, category: "lanthanide", electronConfig: "[Xe] 4f5 6s2" },
  { number: 62, symbol: "Sm", name: "Samarium", mass: 150.36, category: "lanthanide", electronConfig: "[Xe] 4f6 6s2", electronegativity: 1.17 },
  { number: 63, symbol: "Eu", name: "Europium", mass: 151.96, category: "lanthanide", electronConfig: "[Xe] 4f7 6s2" },
  { number: 64, symbol: "Gd", name: "Gadolinium", mass: 157.25, category: "lanthanide", electronConfig: "[Xe] 4f7 5d1 6s2", electronegativity: 1.20 },
  { number: 65, symbol: "Tb", name: "Terbium", mass: 158.93, category: "lanthanide", electronConfig: "[Xe] 4f9 6s2" },
  { number: 66, symbol: "Dy", name: "Dysprosium", mass: 162.50, category: "lanthanide", electronConfig: "[Xe] 4f10 6s2", electronegativity: 1.22 },
  { number: 67, symbol: "Ho", name: "Holmium", mass: 164.93, category: "lanthanide", electronConfig: "[Xe] 4f11 6s2", electronegativity: 1.23 },
  { number: 68, symbol: "Er", name: "Erbium", mass: 167.26, category: "lanthanide", electronConfig: "[Xe] 4f12 6s2", electronegativity: 1.24 },
  { number: 69, symbol: "Tm", name: "Thulium", mass: 168.93, category: "lanthanide", electronConfig: "[Xe] 4f13 6s2", electronegativity: 1.25 },
  { number: 70, symbol: "Yb", name: "Ytterbium", mass: 173.05, category: "lanthanide", electronConfig: "[Xe] 4f14 6s2" },
  { number: 71, symbol: "Lu", name: "Lutetium", mass: 174.97, category: "lanthanide", electronConfig: "[Xe] 4f14 5d1 6s2", electronegativity: 1.27 },
  { number: 72, symbol: "Hf", name: "Hafnium", mass: 178.49, category: "transition metal", electronConfig: "[Xe] 4f14 5d2 6s2", electronegativity: 1.3 },
  { number: 73, symbol: "Ta", name: "Tantalum", mass: 180.95, category: "transition metal", electronConfig: "[Xe] 4f14 5d3 6s2", electronegativity: 1.5 },
  { number: 74, symbol: "W", name: "Tungsten", mass: 183.84, category: "transition metal", electronConfig: "[Xe] 4f14 5d4 6s2", electronegativity: 2.36 },
  { number: 75, symbol: "Re", name: "Rhenium", mass: 186.21, category: "transition metal", electronConfig: "[Xe] 4f14 5d5 6s2", electronegativity: 1.9 },
  { number: 76, symbol: "Os", name: "Osmium", mass: 190.23, category: "transition metal", electronConfig: "[Xe] 4f14 5d6 6s2", electronegativity: 2.2 },
  { number: 77, symbol: "Ir", name: "Iridium", mass: 192.22, category: "transition metal", electronConfig: "[Xe] 4f14 5d7 6s2", electronegativity: 2.20 },
  { number: 78, symbol: "Pt", name: "Platinum", mass: 195.08, category: "transition metal", electronConfig: "[Xe] 4f14 5d9 6s1", electronegativity: 2.28 },
  { number: 79, symbol: "Au", name: "Gold", mass: 196.97, category: "transition metal", electronConfig: "[Xe] 4f14 5d10 6s1", electronegativity: 2.54 },
  { number: 80, symbol: "Hg", name: "Mercury", mass: 200.59, category: "transition metal", electronConfig: "[Xe] 4f14 5d10 6s2", electronegativity: 2.00 },
  { number: 81, symbol: "Tl", name: "Thallium", mass: 204.38, category: "post-transition metal", electronConfig: "[Xe] 4f14 5d10 6s2 6p1", electronegativity: 1.62 },
  { number: 82, symbol: "Pb", name: "Lead", mass: 207.2, category: "post-transition metal", electronConfig: "[Xe] 4f14 5d10 6s2 6p2", electronegativity: 1.87 },
  { number: 83, symbol: "Bi", name: "Bismuth", mass: 208.98, category: "post-transition metal", electronConfig: "[Xe] 4f14 5d10 6s2 6p3", electronegativity: 2.02 },
  { number: 84, symbol: "Po", name: "Polonium", mass: 209, category: "post-transition metal", electronConfig: "[Xe] 4f14 5d10 6s2 6p4", electronegativity: 2.0 },
  { number: 85, symbol: "At", name: "Astatine", mass: 210, category: "halogen", electronConfig: "[Xe] 4f14 5d10 6s2 6p5", electronegativity: 2.2 },
  { number: 86, symbol: "Rn", name: "Radon", mass: 222, category: "noble gas", electronConfig: "[Xe] 4f14 5d10 6s2 6p6" },
  // Period 7
  { number: 87, symbol: "Fr", name: "Francium", mass: 223, category: "alkali metal", electronConfig: "[Rn] 7s1", electronegativity: 0.7 },
  { number: 88, symbol: "Ra", name: "Radium", mass: 226, category: "alkaline earth", electronConfig: "[Rn] 7s2", electronegativity: 0.9 },
  { number: 89, symbol: "Ac", name: "Actinium", mass: 227, category: "actinide", electronConfig: "[Rn] 6d1 7s2", electronegativity: 1.1 },
  { number: 90, symbol: "Th", name: "Thorium", mass: 232.04, category: "actinide", electronConfig: "[Rn] 6d2 7s2", electronegativity: 1.3 },
  { number: 91, symbol: "Pa", name: "Protactinium", mass: 231.04, category: "actinide", electronConfig: "[Rn] 5f2 6d1 7s2", electronegativity: 1.5 },
  { number: 92, symbol: "U", name: "Uranium", mass: 238.03, category: "actinide", electronConfig: "[Rn] 5f3 6d1 7s2", electronegativity: 1.38 },
  { number: 93, symbol: "Np", name: "Neptunium", mass: 237, category: "actinide", electronConfig: "[Rn] 5f4 6d1 7s2", electronegativity: 1.36 },
  { number: 94, symbol: "Pu", name: "Plutonium", mass: 244, category: "actinide", electronConfig: "[Rn] 5f6 7s2", electronegativity: 1.28 },
  { number: 95, symbol: "Am", name: "Americium", mass: 243, category: "actinide", electronConfig: "[Rn] 5f7 7s2", electronegativity: 1.13 },
  { number: 96, symbol: "Cm", name: "Curium", mass: 247, category: "actinide", electronConfig: "[Rn] 5f7 6d1 7s2", electronegativity: 1.28 },
  { number: 97, symbol: "Bk", name: "Berkelium", mass: 247, category: "actinide", electronConfig: "[Rn] 5f9 7s2", electronegativity: 1.3 },
  { number: 98, symbol: "Cf", name: "Californium", mass: 251, category: "actinide", electronConfig: "[Rn] 5f10 7s2", electronegativity: 1.3 },
  { number: 99, symbol: "Es", name: "Einsteinium", mass: 252, category: "actinide", electronConfig: "[Rn] 5f11 7s2", electronegativity: 1.3 },
  { number: 100, symbol: "Fm", name: "Fermium", mass: 257, category: "actinide", electronConfig: "[Rn] 5f12 7s2", electronegativity: 1.3 },
  { number: 101, symbol: "Md", name: "Mendelevium", mass: 258, category: "actinide", electronConfig: "[Rn] 5f13 7s2", electronegativity: 1.3 },
  { number: 102, symbol: "No", name: "Nobelium", mass: 259, category: "actinide", electronConfig: "[Rn] 5f14 7s2", electronegativity: 1.3 },
  { number: 103, symbol: "Lr", name: "Lawrencium", mass: 266, category: "actinide", electronConfig: "[Rn] 5f14 7s2 7p1" },
  { number: 104, symbol: "Rf", name: "Rutherfordium", mass: 267, category: "transition metal", electronConfig: "[Rn] 5f14 6d2 7s2" },
  { number: 105, symbol: "Db", name: "Dubnium", mass: 268, category: "transition metal", electronConfig: "[Rn] 5f14 6d3 7s2" },
  { number: 106, symbol: "Sg", name: "Seaborgium", mass: 269, category: "transition metal", electronConfig: "[Rn] 5f14 6d4 7s2" },
  { number: 107, symbol: "Bh", name: "Bohrium", mass: 270, category: "transition metal", electronConfig: "[Rn] 5f14 6d5 7s2" },
  { number: 108, symbol: "Hs", name: "Hassium", mass: 277, category: "transition metal", electronConfig: "[Rn] 5f14 6d6 7s2" },
  { number: 109, symbol: "Mt", name: "Meitnerium", mass: 278, category: "unknown", electronConfig: "[Rn] 5f14 6d7 7s2" },
  { number: 110, symbol: "Ds", name: "Darmstadtium", mass: 281, category: "unknown", electronConfig: "[Rn] 5f14 6d8 7s2" },
  { number: 111, symbol: "Rg", name: "Roentgenium", mass: 282, category: "unknown", electronConfig: "[Rn] 5f14 6d9 7s2" },
  { number: 112, symbol: "Cn", name: "Copernicium", mass: 285, category: "transition metal", electronConfig: "[Rn] 5f14 6d10 7s2" },
  { number: 113, symbol: "Nh", name: "Nihonium", mass: 286, category: "unknown", electronConfig: "[Rn] 5f14 6d10 7s2 7p1" },
  { number: 114, symbol: "Fl", name: "Flerovium", mass: 289, category: "unknown", electronConfig: "[Rn] 5f14 6d10 7s2 7p2" },
  { number: 115, symbol: "Mc", name: "Moscovium", mass: 290, category: "unknown", electronConfig: "[Rn] 5f14 6d10 7s2 7p3" },
  { number: 116, symbol: "Lv", name: "Livermorium", mass: 293, category: "unknown", electronConfig: "[Rn] 5f14 6d10 7s2 7p4" },
  { number: 117, symbol: "Ts", name: "Tennessine", mass: 294, category: "unknown", electronConfig: "[Rn] 5f14 6d10 7s2 7p5" },
  { number: 118, symbol: "Og", name: "Oganesson", mass: 294, category: "noble gas", electronConfig: "[Rn] 5f14 6d10 7s2 7p6" },
];

// Build lookup indices
const bySymbol = new Map<string, Element>();
const byName = new Map<string, Element>();
const byNumber = new Map<number, Element>();

for (const el of ELEMENTS) {
  bySymbol.set(el.symbol.toLowerCase(), el);
  byName.set(el.name.toLowerCase(), el);
  byNumber.set(el.number, el);
}

/**
 * Look up an element by symbol, name, or atomic number.
 */
export function lookupElement(query: string): Element | undefined {
  const q = query.trim().toLowerCase();

  // Try atomic number
  const num = Number(q);
  if (!isNaN(num) && byNumber.has(num)) {return byNumber.get(num);}

  // Try symbol (case-insensitive)
  if (bySymbol.has(q)) {return bySymbol.get(q);}

  // Try name
  if (byName.has(q)) {return byName.get(q);}

  // Fuzzy: partial name match
  for (const el of ELEMENTS) {
    if (el.name.toLowerCase().includes(q)) {return el;}
  }

  return undefined;
}

/**
 * Format an element for display.
 */
export function formatElement(el: Element): string {
  const lines: string[] = [
    `**${el.name}** (${el.symbol}) — Atomic #${el.number}`,
    `Atomic Mass: ${el.mass} u`,
    `Category: ${el.category}`,
    `Electron Config: ${el.electronConfig}`,
  ];
  if (el.electronegativity !== undefined) {lines.push(`Electronegativity: ${el.electronegativity}`);}
  if (el.meltingPoint !== undefined) {lines.push(`Melting Point: ${el.meltingPoint} K`);}
  if (el.boilingPoint !== undefined) {lines.push(`Boiling Point: ${el.boilingPoint} K`);}
  if (el.density !== undefined) {lines.push(`Density: ${el.density} g/cm³`);}
  return lines.join("\n");
}

/**
 * Get all elements, optionally filtered by category.
 */
export function getElementsByCategory(category: string): Element[] {
  const q = category.toLowerCase();
  return ELEMENTS.filter((el) => el.category.toLowerCase().includes(q));
}

export { ELEMENTS };
