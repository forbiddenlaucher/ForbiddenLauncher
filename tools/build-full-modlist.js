const fs = require('fs');
const path = require('path');

const modDescriptions = {
  // Tech & Energy
  'mekanism': { name: 'Mekanism', cat: 'Alta Tecnologia', desc: 'Processamento quântico de minérios x5, maquinários a laser e reatores de fusão.' },
  'mekanismgenerators': { name: 'Mekanism Generators', cat: 'Geração de Energia', desc: 'Turbinas a gás, reatores nucleares, geradores solares e eólicos avançados.' },
  'mekanismtools': { name: 'Mekanism Tools', cat: 'Armaduras & Armas', desc: 'Ferramentas de lazulita, osmium, obsidian refinada e armaduras de alta resistência.' },
  'ae2': { name: 'Applied Energistics 2', cat: 'Armazenamento ME', desc: 'Redes quânticas de armazenamento digital com cabos de fibra e autocrafting.' },
  'advanced_ae': { name: 'Advanced AE', cat: 'Expansão ME', desc: 'Padrões moleculares aprimorados e aceleração extrema de processamento AE2.' },
  'ae2wtlib': { name: 'AE2 Wireless Terminal', cat: 'Terminais Sem Fio', desc: 'Acesso sem fio ilimitado aos seus sistemas ME em qualquer dimensão.' },
  'appflux': { name: 'Applied Flux', cat: 'Energia ME', desc: 'Integração de transferência direta de energia através de redes Applied Energistics.' },
  'appmek': { name: 'Applied Mekanistics', cat: 'Integração Tech', desc: 'Armazenamento de gases e químicos do Mekanism diretamente no sistema ME.' },
  'powah': { name: 'Powah!', cat: 'Geração de Energia', desc: 'Geradores termoelétricos, reatores nucleares, ender cells e baterias de alta densidade.' },
  'fluxnetworks': { name: 'Flux Networks', cat: 'Rede Elétrica Wireless', desc: 'Transmissão sem fio de energia dimensional infinita sem perda de sinal.' },
  'pipez': { name: 'Pipez', cat: 'Tubulações & Logística', desc: 'Tubos ultra-rápidos e compactos para transferência de itens, fluidos, gases e energia.' },
  'modularrouters': { name: 'Modular Routers', cat: 'Logística Avançada', desc: 'Roteadores modulares configuráveis para automação ultra-rápida de itens.' },
  'industrialforegoing': { name: 'Industrial Foregoing', cat: 'Automação Industrial', desc: 'Fábricas de mob grinding, processamento de borracha, bio-reatores e laser drills.' },
  'enderio': { name: 'Ender IO', cat: 'Cabos Compactos & Tech', desc: 'Conduítes que compartilham o mesmo bloco para itens, energia, fluidos e redstone.' },
  'bigreactors': { name: 'Extreme Reactors 2', cat: 'Reatores Nucleares', desc: 'Reatores multiblock gigantes e turbinas a vapor para produção massiva de energia.' },
  'draconicevolution': { name: 'Draconic Evolution', cat: 'Tecnologia Cósmica', desc: 'Equipamentos de energia cósmica draconiana, esferas de contenção e reatores de caos.' },
  'refinedstorage': { name: 'Refined Storage', cat: 'Armazenamento Digital', desc: 'Sistemas limpos de armazenamento em rede, transmissores sem fio e autocrafting.' },
  'rftools': { name: 'RFTools', cat: 'Automação & Dimensões', desc: 'Geradores de energia, teletransportadores modulares, telas digitais e construtores.' },
  'modern_industrialization': { name: 'Modern Industrialization', cat: 'Engenharia Pesada', desc: 'Vapor, eletricidade, refinarias químicas e forjas industriais de grande porte.' },
  'oritech': { name: 'Oritech', cat: 'Alta Tecnologia', desc: 'Reatores de partículas, usinagem futurista e automações energéticas de precisão.' },
  'superfactorymanager': { name: 'Super Factory Manager', cat: 'Automação Lógica', desc: 'Controle programável multithread de inventários, frotas de fábricas e fluidos.' },
  'laserbridges': { name: 'Laser Bridges', cat: 'Pontes Laser', desc: 'Portais e pontes de luz sólida laser de alta tecnologia com detecção de entidades.' },
  'laserio': { name: 'LaserIO', cat: 'Logística Laser', desc: 'Conexões de laser minúsculas capazes de transferir milhares de itens por segundo.' },

  // Kinetic Engineering
  'create': { name: 'Create', cat: 'Engenharia Cinética', desc: 'Engrenagens, correias, eixos giratórios, moinhos, trens customizados e guindastes.' },
  'createaddition': { name: 'Create Crafts & Additions', cat: 'Eletricidade Cinética', desc: 'Alternadores para converter energia rotacional do Create em eletricidade Forge/FE.' },
  'create_enchantment_industry': { name: 'Create Enchantment Industry', cat: 'Encantamento Cinético', desc: 'Impressoras mecânicas de livros de encantamentos e manipulação de XP líquido.' },
  'create_aquatic_ambitions': { name: 'Create Aquatic Ambitions', cat: 'Engenharia Náutica', desc: 'Sistemas subaquáticos mecânicos, hélices e turbinas aquáticas do Create.' },
  'create_dragons_plus': { name: 'Create Dragons Plus', cat: 'Engenharia Épica', desc: 'Integração cinética entre máquinas do Create e forjas de sangue de dragões.' },

  // Magic & Dimensions
  'ars_nouveau': { name: 'Ars Nouveau', cat: 'Magia Personalizada', desc: 'Crie seus próprios feitiços arcanos com glifos, rituais e invoque familiares mágicos.' },
  'ars_elemental': { name: 'Ars Elemental', cat: 'Feitiçaria Elemental', desc: 'Feitiços de ar, água, terra e fogo, novos familiares e armas encantadas arcanas.' },
  'ars_creo': { name: 'Ars Creo', cat: 'Tecnomagia', desc: 'Fusão perfeita entre a magia do Ars Nouveau e a engenharia cinética do Create.' },
  'occultism': { name: 'Occultism', cat: 'Ocultismo & Rituais', desc: 'Invoque espíritos através de velas e giz ritualístico para minerar e armazenar itens.' },
  'irons_spellbooks': { name: 'Iron\'s Spells \'n Spellbooks', cat: 'Grimórios & Magia RPG', desc: 'Mais de 80 magias com animações épicas em 3D, armaduras de mago e cajados.' },
  'forbidden_arcanus': { name: 'Forbidden & Arcanus', cat: 'Relíquias Proibidas', desc: 'Forja hephaestus, auréolas sagradas, almas perdidas e rituais de transmutação.' },
  'evilcraft': { name: 'EvilCraft', cat: 'Magia Sombria', desc: 'Rituais de sangue, monstros amaldiçoados e ferramentas alquímicas das trevas.' },
  'mahoutsukai': { name: 'Mahou Tsukai', cat: 'Magia de Projeção', desc: 'Rituais mágicos com efeitos visuais deslumbrantes, espadas de projeção e barreiras.' },
  'the_undergarden': { name: 'The Undergarden', cat: 'Dimensão Subterrânea', desc: 'Um mundo subterrâneo sombrio sob as profundezas do bedrock, com monstros únicos.' },
  'twilightforest': { name: 'The Twilight Forest', cat: 'Dimensão dos Titãs', desc: 'Explore castelos mágicos, florestas encantadas e derrote a Hydra, Ur-Ghast e Naga.' },
  'aether': { name: 'The Aether', cat: 'Dimensão dos Céus', desc: 'O clássico paraíso celestial nas nuvens com templos, moas voadoras e masmorras.' },
  'the_bumblezone': { name: 'The Bumblezone', cat: 'Dimensão das Abelhas', desc: 'Dimensão viva dentro de uma colmeia com mel, ferrões lendários e a Abelha Rainha.' },
  'eternal_starlight': { name: 'Eternal Starlight', cat: 'Dimensão Estelar', desc: 'Uma dimensão crepuscular iluminada por auroras e estrelas com novos chefes.' },
  'deeperdarker': { name: 'Deeper and Darker', cat: 'Dimensão do Sculk', desc: 'Atravesse o portal do Warden para a misteriosa dimensão do The Otherside.' },

  // Agriculture, Bees & Resources
  'mysticalagriculture': { name: 'Mystical Agriculture', cat: 'Cultivo de Recursos', desc: 'Plante sementes mágicas para colher minérios, essências de monstros e materiais.' },
  'mysticalagradditions': { name: 'Mystical Agradditions', cat: 'Cultivo Extremo', desc: 'Sementes Tier 6 para Netherite, Allthemodium e essência draconiana.' },
  'productivebees': { name: 'Productive Bees', cat: 'Apicultura Avançada', desc: 'Centenas de espécies de abelhas geneticamente aprimoradas que produzem minérios.' },
  'productivetrees': { name: 'Productive Trees', cat: 'Silvicultura Avançada', desc: 'Dezenas de árvores exóticas produtoras de frutos, seivas especiais e madeiras raras.' },
  'botanypots': { name: 'Botany Pots', cat: 'Vasos Automáticos', desc: 'Vasos compactos que cultivam e colhem plantas e árvores automaticamente.' },
  'farmersdelight': { name: 'Farmer\'s Delight', cat: 'Culinária & Gastronomia', desc: 'Panelas de cozimento, facas, tábuas de corte e dezenas de pratos deliciosos.' },
  'cookingforblockheads': { name: 'Cooking for Blockheads', cat: 'Cozinha Inteligente', desc: 'Cozinha modular que consome ingredientes da geladeira para receitas instantâneas.' },
  'allthemodium': { name: 'AllTheModium', cat: 'Metais Místicos ATM', desc: 'Metais sagrados lendários (Allthemodium, Vibranium, Unobtainium) para a ATM Star.' },
  'alltheores': { name: 'All The Ores', cat: 'Minérios Unificados', desc: 'Geração unificada de cobre, estanho, chumbo, prata, alumínio, níquel, urânio e platina.' },

  // Storage & Inventories
  'sophisticatedbackpacks': { name: 'Sophisticated Backpacks', cat: 'Mochilas Modulares', desc: 'Mochilas customizáveis com filtros inteligentes, upgrades de auto-alimentação e craft.' },
  'sophisticatedstorage': { name: 'Sophisticated Storage', cat: 'Baús Modulares', desc: 'Baús, barris e shulkers de madeira a netherite com capacidade massiva e upgrades.' },
  'functionalstorage': { name: 'Functional Storage', cat: 'Gavetas de Armazenamento', desc: 'Armazenamento massivo de blocos/itens em gavetas com upgrades x32 e links wireless.' },
  'dimstorage': { name: 'DimStorage', cat: 'Baú Dimensional', desc: 'Baús e tanques conectados por frequência de cores através de todas as dimensões.' },
  'enderstorage': { name: 'Ender Storage', cat: 'Ender Chests Coloridos', desc: 'Ender Chests e Ender Tanks com frequência de cores de lã personalizável.' },

  // Building & Decoration
  'chipped': { name: 'Chipped', cat: 'Arquitetura & Blocos', desc: 'Mesas de trabalho especiais com mais de 3.000 variações arquitetônicas de blocos.' },
  'rechiseled': { name: 'Rechiseled', cat: 'Decoração & Texturas', desc: 'Variantes com texturas conectadas modernas para vidro, pedra, metal e madeira.' },
  'framedblocks': { name: 'FramedBlocks', cat: 'Formas Geométricas', desc: 'Rampas, pilares, curvas e pirâmides que assumem a textura de qualquer bloco.' },
  'macaw': { name: 'Macaw\'s Suite', cat: 'Mobiliário & Estruturas', desc: 'Pontes suspensas, portas de castelo, janelas, móveis, telhados e cercas medievais.' },
  'handcrafted': { name: 'Handcrafted', cat: 'Móveis Detalhados', desc: 'Mesas, cadeiras de jantar, sofás, almofadas e decorações aconchegantes em 3D.' },
  'refurbished_furniture': { name: 'MrCrayfish\'s Furniture', cat: 'Móveis Modernos', desc: 'Geladeiras funcionais, fogões, sofás, luminárias e aparelhos modernos.' },
  'connectedglass': { name: 'Connected Glass', cat: 'Vidro Sem Borda', desc: 'Vidros transparentes, foscos e coloridos com texturas 100% conectadas e limpas.' },

  // RPG, Worldgen & Dungeons
  'dungeons_arise': { name: 'When Dungeons Arise', cat: 'Mega Masmorras', desc: 'Castelos nos céus, fortalezas no oceano e masmorras colossais cheias de saques.' },
  'dungeoncrawl': { name: 'Dungeon Crawl', cat: 'Masmorras Subterrâneas', desc: 'Masmorras multiníveis geradas proceduralmente com salas de tesouro e chefes.' },
  'cataclysm': { name: 'L_Ender\'s Cataclysm', cat: 'Chefes Lendários', desc: 'Chefes mitológicos monumentais como o Ignis, Netherite Monstrosity e Leviathan.' },
  'iceandfire': { name: 'Ice and Fire', cat: 'Dragões & Bestas', desc: 'Dragões de fogo, gelo e relâmpago, górgonas, hidras, hipogrifos e forjas de ossos.' },
  'apotheosis': { name: 'Apotheosis', cat: 'RPG & Encantamentos', desc: 'Encantamentos até nível 100+, monstros chefes com afixos de RPG e gemas preciosas.' },
  'artifacts': { name: 'Artifacts', cat: 'Relíquias & Amuletos', desc: 'Acessórios mágicos raros encontrados em baús que concedem habilidades únicas.' },
  'relics': { name: 'Relics', cat: 'Relíquias RPG', desc: 'Artefatos lendários com árvore de habilidades que sobem de nível conforme você joga.' },
  'waystones': { name: 'Waystones', cat: 'Teletransporte Rápido', desc: 'Monólitos de teletransporte para navegar rapidamente entre vilas e bases.' },
  'ctov': { name: 'ChoiceTheorem\'s Villages', cat: 'Vilas Épicas', desc: 'Vilas totalmente redecoradas adaptadas para cada bioma do mundo.' },
  'yung': { name: 'YUNG\'s Worldgen Suite', cat: 'Estruturas Renovadas', desc: 'Mineshafts, fortalezas do Nether, templos do deserto e strongholds monumentais.' },
  'regions_unexplored': { name: 'Regions Unexplored', cat: 'Biomas Magníficos', desc: 'Mais de 70 novos biomas deslumbrantes para explorar no Overworld, Nether e End.' },
  'oh_the_biomes_weve_gone': { name: 'Oh The Biomes We\'ve Gone', cat: 'Novos Biomas', desc: 'Mundos coloridos com árvores gigantescas, montanhas dramáticas e florestas mágicas.' },
  'minecolonies': { name: 'MineColonies', cat: 'Colônias & Civilizações', desc: 'Construa e lidere sua própria cidade medieval com guardas, ferreiros, padeiros e cidadãos.' },

  // Optimization & Interface
  'sodium': { name: 'Sodium / Embeddium', cat: 'Otimização Gráfica', desc: 'Multiplicador de FPS com renderização gráfica moderna em OpenGL shader.' },
  'iris': { name: 'Iris Shaders', cat: 'Suporte a Shaders', desc: 'Execute shaders modernos ultrarrealistas sem perda severa de desempenho.' },
  'ferritecore': { name: 'FerriteCore', cat: 'Otimização de RAM', desc: 'Reduz o consumo de memória RAM do Minecraft em até 30% otimizando modelos.' },
  'modernfix': { name: 'ModernFix', cat: 'Otimização Extrema', desc: 'Reduz o tempo de carregamento do modpack e corrige vazamentos de memória.' },
  'jei': { name: 'Just Enough Items (JEI)', cat: 'Guia de Receitas', desc: 'Exibe todas as receitas de craft, forjas, reatores e rituais com a tecla R e U.' },
  'journeymap': { name: 'JourneyMap', cat: 'Minimapa & Radar', desc: 'Minimapa em tempo real com radar de monstros, marcação de waypoints e mapa de cavernas.' },
  'jade': { name: 'Jade (WAILA)', cat: 'Identificador de Blocos', desc: 'Mostra instantaneamente o nome, energia, fluidos e conteúdo do bloco que você está olhando.' },
  'ftbquests': { name: 'FTB Quests', cat: 'Missões & Recompensas', desc: 'Livro completo de missões guiadas para acompanhar sua progressão até a ATM Star.' },
  'ftbchunks': { name: 'FTB Chunks', cat: 'Proteção de Terreno', desc: 'Reivindique e carregue seus chunks para proteger sua base contra greifing.' },
  'ftbultimine': { name: 'FTB Ultimine', cat: 'Mineração em Cadeia', desc: 'Segure a tecla de atalho para quebrar veios inteiros de minérios ou árvores de uma vez.' }
};

function categorizeMod(fileName) {
  const lower = fileName.toLowerCase();
  for (const [key, info] of Object.entries(modDescriptions)) {
    if (lower.includes(key)) {
      return info;
    }
  }

  // Generic fallback parser
  let cleanName = fileName
    .replace(/\.jar$/i, '')
    .replace(/^\[.*?\]/g, '')
    .replace(/[-_]neoforge.*$/i, '')
    .replace(/[-_]forge.*$/i, '')
    .replace(/[-_]\d+.*$/i, '')
    .replace(/[-_]mc\d+.*$/i, '')
    .replace(/[-_]/g, ' ')
    .trim();

  // Capitalize
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  let cat = 'Utilidades & Mods';
  let desc = 'Adiciona novos recursos, melhorias e ferramentas ao modpack.';

  if (/ore|metal|ingot|gem/i.test(cleanName)) { cat = 'Minérios & Recursos'; desc = 'Adiciona novos minérios, metais preciosos e materiais de forja.'; }
  else if (/food|farm|crop|cook|delight/i.test(cleanName)) { cat = 'Agricultura & Culinária'; desc = 'Novos cultivos, sementes, alimentos e ferramentas de cozinha.'; }
  else if (/storage|chest|drawer|barrel|bag/i.test(cleanName)) { cat = 'Armazenamento'; desc = 'Opções expandidas para organização e guarda de itens.'; }
  else if (/magic|spell|arcane|tome|glyph/i.test(cleanName)) { cat = 'Magia & Encantos'; desc = 'Feitiçaria mística, rituais e encantamentos sobrenaturais.'; }
  else if (/energy|generator|power|flux|cable/i.test(cleanName)) { cat = 'Energia & Elétrica'; desc = 'Geração, transporte e armazenamento de energia de alta eficiência.'; }
  else if (/structure|dungeon|temple|village/i.test(cleanName)) { cat = 'Estruturas & Mundos'; desc = 'Novas estruturas épicas e locais de exploração no mapa.'; }
  else if (/fix|fast|opti|sodium|smooth|memory/i.test(cleanName)) { cat = 'Performance'; desc = 'Otimização de FPS, redução de lag e melhoria de carregamento.'; }
  else if (/furniture|decor|block|glass|light/i.test(cleanName)) { cat = 'Construção & Design'; desc = 'Blocos arquitetônicos, iluminação e decorações de alto nível.'; }

  return { name: cleanName, cat, desc };
}

const appData = process.env.APPDATA || 'C:\\Users\\takamura\\AppData\\Roaming';
const modsDir = path.join(appData, 'ForbiddenLauncher', 'instances', 'atm10', '.minecraft', 'mods');

if (fs.existsSync(modsDir)) {
  const files = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'));
  console.log(`Encontrados ${files.length} mods no diretório do ATM10.`);
  
  const allParsedMods = [];
  const seenNames = new Set();

  for (const f of files) {
    const info = categorizeMod(f);
    if (!seenNames.has(info.name.toLowerCase())) {
      seenNames.add(info.name.toLowerCase());
      allParsedMods.push({
        name: info.name,
        category: info.cat,
        description: info.desc
      });
    }
  }

  // Sort alphabetically by name
  allParsedMods.sort((a, b) => a.name.localeCompare(b.name));

  const outPath = path.join(__dirname, '../src/renderer/assets/atm10_full_mods.json');
  fs.writeFileSync(outPath, JSON.stringify(allParsedMods, null, 2), 'utf8');
  console.log(`Gerado arquivo com ${allParsedMods.length} mods em: ${outPath}`);
} else {
  console.error('Pasta de mods do ATM10 não encontrada em:', modsDir);
}
