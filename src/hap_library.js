/**
 * Carrier HAP 6.4 & ASHRAE Standard Reference Library
 * Extracted directly from Carrier HAP 6.4 (eDesign.ReferenceData01.dll & HAPCore64.dll)
 * Contains standard Space Types, Activity Levels, Wall Assemblies, Fenestration & Shading presets.
 */

// 1. Activity Levels (BTU/hr converted to Watts: 1 W = 3.412142 BTU/hr)
export const ACTIVITY_LEVELS = {
    SEATED_AT_REST: {
        id: 'seated_at_rest',
        name: 'Sentado em Repouso (Teatro, Auditório, Espera)',
        sensibleWatts: 67.4,  // 230 BTU/hr
        latentWatts: 35.2     // 120 BTU/hr
    },
    OFFICE_WORK: {
        id: 'office_work',
        name: 'Trabalho de Escritório (Digitação, Computador)',
        sensibleWatts: 71.8,  // 245 BTU/hr
        latentWatts: 60.1     // 205 BTU/hr
    },
    SEDENTARY_WORK: {
        id: 'sedentary_work',
        name: 'Trabalho Sedentário / Reunião (Sentado, Conversa)',
        sensibleWatts: 82.1,  // 280 BTU/hr
        latentWatts: 79.1     // 270 BTU/hr
    },
    MEDIUM_WORK: {
        id: 'medium_work',
        name: 'Trabalho Leve em Pé / Varejo / Comércio',
        sensibleWatts: 86.5,  // 295 BTU/hr
        latentWatts: 133.3    // 455 BTU/hr
    },
    HEAVY_WORK: {
        id: 'heavy_work',
        name: 'Trabalho Pesado / Manuseio de Cargas',
        sensibleWatts: 153.9, // 525 BTU/hr
        latentWatts: 271.1    // 925 BTU/hr
    },
    ATHLETICS: {
        id: 'athletics',
        name: 'Atividades Esportivas / Academia / Ginásio',
        sensibleWatts: 208.1, // 710 BTU/hr
        latentWatts: 319.5    // 1090 BTU/hr
    }
};

// 2. Predefined Space Types (ASHRAE 90.1 / ASHRAE 62.1 per Carrier HAP)
export const SPACE_TYPES = {
    OFFICE_ENCLOSED: {
        id: 'office_enclosed',
        name: 'Escritório Individual / Fechado',
        areaPerPerson: 18.0, // m² per person
        activity: 'OFFICE_WORK',
        lightingWpM2: 10.0, // ASHRAE 90.1 LPD
        equipmentWpM2: 10.0, // ASHRAE EPD
        ventRp: 2.5, // L/s per person (ASHRAE 62.1)
        ventRa: 0.3, // L/s per m² floor area
        notes: 'Escritório privativo com computador e iluminação LED padrão'
    },
    OFFICE_OPEN: {
        id: 'office_open',
        name: 'Escritório Aberto (Open Plan / Co-working)',
        areaPerPerson: 12.0,
        activity: 'OFFICE_WORK',
        lightingWpM2: 8.7,
        equipmentWpM2: 12.0,
        ventRp: 2.5,
        ventRa: 0.3,
        notes: 'Estações de trabalho contínuas com alta densidade de computadores'
    },
    CONFERENCE_ROOM: {
        id: 'conference_room',
        name: 'Sala de Reunião / Conferência',
        areaPerPerson: 2.5, // High density
        activity: 'SEDENTARY_WORK',
        lightingWpM2: 11.5,
        equipmentWpM2: 10.0,
        ventRp: 2.5,
        ventRa: 0.3,
        notes: 'Alta densidade de ocupação e equipamentos audiovisuais'
    },
    CLASSROOM: {
        id: 'classroom',
        name: 'Sala de Aula / Treinamento',
        areaPerPerson: 3.0,
        activity: 'SEATED_AT_REST',
        lightingWpM2: 9.9,
        equipmentWpM2: 6.0,
        ventRp: 5.0,
        ventRa: 0.6,
        notes: 'Padrão escolar com alta taxa de ventilação exterior'
    },
    RETAIL_STORE: {
        id: 'retail_store',
        name: 'Comércio / Loja / Shopping',
        areaPerPerson: 6.0,
        activity: 'MEDIUM_WORK',
        lightingWpM2: 14.0,
        equipmentWpM2: 5.0,
        ventRp: 3.8,
        ventRa: 0.6,
        notes: 'Fluxo constante de clientes em pé e iluminação de destaque'
    },
    RESTAURANT_DINING: {
        id: 'restaurant_dining',
        name: 'Restaurante / Salão de Refeições',
        areaPerPerson: 2.0,
        activity: 'SEDENTARY_WORK',
        lightingWpM2: 8.5,
        equipmentWpM2: 15.0,
        ventRp: 3.8,
        ventRa: 0.9,
        notes: 'Alta carga latente de pessoas e taxa elevada de renovação de ar'
    },
    DATA_CENTER: {
        id: 'data_center',
        name: 'Data Center / CPD / Sala de Servidores',
        areaPerPerson: 50.0, // Rarely occupied
        activity: 'OFFICE_WORK',
        lightingWpM2: 5.0,
        equipmentWpM2: 150.0, // High plug load (150 W/m² to 500 W/m²)
        ventRp: 2.5,
        ventRa: 0.3,
        notes: 'Carga térmica crítica contínua dominada por equipamentos de TI'
    },
    FITNESS_GYM: {
        id: 'fitness_gym',
        name: 'Academia / Sala de Ginástica',
        areaPerPerson: 5.0,
        activity: 'ATHLETICS',
        lightingWpM2: 7.0,
        equipmentWpM2: 10.0,
        ventRp: 10.0,
        ventRa: 0.9,
        notes: 'Carga latente extrema e alta exigência de vazão de ar exterior'
    },
    HOTEL_ROOM: {
        id: 'hotel_room',
        name: 'Quarto de Hotel / Residencial',
        areaPerPerson: 15.0,
        activity: 'SEATED_AT_REST',
        lightingWpM2: 7.5,
        equipmentWpM2: 6.0,
        ventRp: 2.5,
        ventRa: 0.3,
        notes: 'Ocupação moderada com baixa densidade de equipamentos'
    },
    AUDITORIUM: {
        id: 'auditorium',
        name: 'Auditório / Teatro / Cinema',
        areaPerPerson: 1.5,
        activity: 'SEATED_AT_REST',
        lightingWpM2: 12.0,
        equipmentWpM2: 3.0,
        ventRp: 2.5,
        ventRa: 0.3,
        notes: 'Densidade máxima de ocupantes sentados em ambiente fechado'
    },
    CORRIDOR: {
        id: 'corridor',
        name: 'Corredor / Hall de Circulação',
        areaPerPerson: 100.0,
        activity: 'OFFICE_WORK',
        lightingWpM2: 6.6,
        equipmentWpM2: 0.0,
        ventRp: 0.0,
        ventRa: 0.3,
        notes: 'Área de trânsito sem postos de trabalho fixos'
    },
    CUSTOM: {
        id: 'custom',
        name: 'Personalizado (Entrada Manual Livre)',
        areaPerPerson: 10.0,
        activity: 'OFFICE_WORK',
        lightingWpM2: 10.0,
        equipmentWpM2: 15.0,
        ventRp: 2.5,
        ventRa: 0.3,
        notes: 'Permite editar livremente todos os parâmetros térmicos'
    }
};

// 3. Wall Assembly Types (From HAP ConstructionAssemblyData.csv)
export const WALL_ASSEMBLIES = {
    MASONRY_INSULATED: {
        id: 'masonry_insulated',
        name: 'Alvenaria com Isolamento Térmico (Tijolo + Bloco + EPS)',
        uValue: 0.39, // W/m²K (HAP Face Brick + Block Insulated: 0.068 BTU = 0.386 W/m²K)
        weightKgM2: 240,
        defaultAbsorptivity: 0.675
    },
    MASONRY_UNINSULATED: {
        id: 'masonry_uninsulated',
        name: 'Alvenaria Convencional Tijolo Furado 15cm c/ Reboco',
        uValue: 1.90, // W/m²K
        weightKgM2: 180,
        defaultAbsorptivity: 0.675
    },
    CONCRETE_STRUCTURAL: {
        id: 'concrete_structural',
        name: 'Bloco de Concreto / Parede de Concreto Maciço 15cm',
        uValue: 2.40, // W/m²K
        weightKgM2: 320,
        defaultAbsorptivity: 0.675
    },
    STEEL_FRAME_INSULATED: {
        id: 'steel_frame_insulated',
        name: 'Drywall / Steel Frame c/ Lã de Vidro / Rocha',
        uValue: 0.43, // W/m²K (HAP Stucco + Metal Frame: 0.077 BTU = 0.437 W/m²K)
        weightKgM2: 45,
        defaultAbsorptivity: 0.675
    },
    CURTAIN_WALL: {
        id: 'curtain_wall',
        name: 'Fachada Cortina Pele de Vidro (Insulated Glass Spandrel)',
        uValue: 2.10, // W/m²K
        weightKgM2: 35,
        defaultAbsorptivity: 0.70
    },
    INTERNAL_PARTITION: {
        id: 'internal_partition',
        name: 'Divisória Interna (Gesso / Drywall duplo ou Alvenaria 10cm)',
        uValue: 1.74, // W/m²K (HAP Gypsum Board Wall: 0.306 BTU = 1.737 W/m²K)
        weightKgM2: 30,
        defaultAbsorptivity: 0.45
    },
    CUSTOM: {
        id: 'custom',
        name: 'Personalizado (Digitar U)',
        uValue: 0.45,
        weightKgM2: 150,
        defaultAbsorptivity: 0.675
    }
};

// Surface Solar Absorptance (From HAP Colors: Light 0.45, Medium 0.675, Dark 0.90)
export const SURFACE_COLORS = {
    LIGHT: {
        id: 'light',
        name: 'Clara (Branco, Gelo, Bege Claro - Reflete o Sol)',
        absorptivity: 0.40
    },
    MEDIUM: {
        id: 'medium',
        name: 'Média (Cinza, Amarelo Claro, Padrão HAP)',
        absorptivity: 0.675
    },
    DARK: {
        id: 'dark',
        name: 'Escura (Tijolo Aparente, Marrom, Preto, Concreto Escuro)',
        absorptivity: 0.90
    }
};

// 4. Window & Glazing Assemblies (From HAP WindowAssemblyData.csv)
export const WINDOW_ASSEMBLIES = {
    SINGLE_CLEAR: {
        id: 'single_clear',
        name: 'Vidro Simples Transparente 6mm',
        uValue: 5.80, // W/m²K (HAP: 1.04 BTU = 5.91 W/m²K)
        shgc: 0.82    // HAP: 0.86
    },
    SINGLE_TINT: {
        id: 'single_tint',
        name: 'Vidro Simples Fumê / Bronze / Verde 6mm',
        uValue: 5.80,
        shgc: 0.70    // HAP: 0.70 - 0.73
    },
    SINGLE_REFLECTIVE: {
        id: 'single_reflective',
        name: 'Vidro Simples Refletivo / Espelhado',
        uValue: 5.80,
        shgc: 0.25    // HAP: 0.25
    },
    DOUBLE_CLEAR: {
        id: 'double_clear',
        name: 'Vidro Duplo Transparente (4+12ar+4)',
        uValue: 2.80, // W/m²K (HAP: 0.55 BTU = 3.12 W/m²K)
        shgc: 0.70    // HAP: 0.76
    },
    DOUBLE_LOW_E: {
        id: 'double_low_e',
        name: 'Vidro Duplo com Película Low-E de Alta Performance',
        uValue: 1.60, // W/m²K (HAP: 0.45 BTU = 2.56 W/m²K)
        shgc: 0.38    // HAP: 0.40 - 0.55
    },
    LAMINATED_SOLAR: {
        id: 'laminated_solar',
        name: 'Vidro Laminado de Controle Solar (PVB Acústico/Térmico)',
        uValue: 3.40,
        shgc: 0.45
    },
    CUSTOM: {
        id: 'custom',
        name: 'Personalizado (Digitar U e SHGC)',
        uValue: 2.40,
        shgc: 0.40
    }
};

// Internal Shading / Blind Attenuation Factor (IAC)
export const INTERNAL_SHADING = {
    NONE: {
        id: 'none',
        name: 'Nenhuma (Vidro Totalmente Desobstruído)',
        iac: 1.00
    },
    BLINDS_LIGHT: {
        id: 'blinds_light',
        name: 'Persiana Horizontal Clara (Fechada)',
        iac: 0.65
    },
    CURTAIN_MEDIUM: {
        id: 'curtain_medium',
        name: 'Cortina de Tecido Médio',
        iac: 0.70
    },
    BLACKOUT: {
        id: 'blackout',
        name: 'Cortina Blecaute / Persiana Rolo Térmica',
        iac: 0.45
    }
};

// 5. Roof Assemblies (From HAP ConstructionAssemblyData.csv)
export const ROOF_ASSEMBLIES = {
    INSULATED_DECK: {
        id: 'insulated_deck',
        name: 'Laje c/ Isolamento Térmico EPS / PIR (Padrão ASHRAE)',
        uValue: 0.35, // W/m²K (HAP: 0.038 - 0.048 BTU = 0.21 - 0.27 W/m²K)
        absorptivity: 0.675
    },
    UNINSULATED_CONCRETE: {
        id: 'uninsulated_concrete',
        name: 'Laje Maciça de Concreto 12cm sem Isolamento',
        uValue: 2.20, // W/m²K
        absorptivity: 0.75
    },
    SANDWICH_PIR: {
        id: 'sandwich_pir',
        name: 'Telha Metálica Termoacústica Sanduíche (PU / PIR 50mm)',
        uValue: 0.38,
        absorptivity: 0.50
    },
    TILE_WITH_CEILING: {
        id: 'tile_with_ceiling',
        name: 'Telha Cerâmica / Fibrocimento com Forro de Gesso',
        uValue: 1.60,
        absorptivity: 0.70
    }
};

// 6. Floor Assemblies (From HAP ConstructionAssemblyData.csv)
export const FLOOR_ASSEMBLIES = {
    SLAB_ON_GRADE: {
        id: 'slab_on_grade',
        name: 'Piso sobre Solo (Slab-on-grade) - Contato Terrestre',
        uValue: 0.70, // W/m²K
        isGroundContact: true
    },
    OVER_PILOTIS: {
        id: 'over_pilotis',
        name: 'Piso sobre Pilotis / Garagem Aberta (Ar Externo)',
        uValue: 0.45,
        isGroundContact: false
    },
    INTERIOR_FLOOR: {
        id: 'interior_floor',
        name: 'Piso entre Andares Condicionados (Adiabático)',
        uValue: 0.0,
        isGroundContact: false
    }
};

// Map lowercase IDs to allow both UPPERCASE and lowercase lookup
[ACTIVITY_LEVELS, SPACE_TYPES, WALL_ASSEMBLIES, SURFACE_COLORS, WINDOW_ASSEMBLIES, INTERNAL_SHADING, ROOF_ASSEMBLIES, FLOOR_ASSEMBLIES].forEach(dict => {
    Object.values(dict).forEach(item => {
        if (item && item.id) {
            dict[item.id] = item;
            dict[item.id.toLowerCase()] = item;
            dict[item.id.toUpperCase()] = item;
        }
    });
});
