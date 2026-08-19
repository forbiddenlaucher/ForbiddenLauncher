const fs = require('fs');
const path = require('path');

const forbiddenMods = [
  { name: "Thaumcraft 4", category: "Magia Oculta", description: "Manipule o Vis cósmico, pesquise no Thaumonomicon e desvende os mistérios arcanos do Vazio." },
  { name: "Blood Magic", category: "Alquimia de Sangue", description: "Sacrifique essência vital em altares de sangue para canalizar rituais e magias colossais." },
  { name: "Witchery", category: "Bruxaria & Rituais", description: "Covens de bruxas, rituais no caldeirão, vampirismo, licantropia e sonhos lúcidos no mundo dos espíritos." },
  { name: "Twilight Forest", category: "Dimensão Sombria", description: "Uma floresta mística eterna governada por titãs lendários, castelos e masmorras nas nuvens." },
  { name: "Tinkers' Construct", category: "Forja & Fundição", description: "Funda ligas de metais em smelteries gigantes para forjar ferramentas personalizadas e armas letais." },
  { name: "Grimoire of Gaia 3", category: "Bestiário Sombrio", description: "Criaturas mitológicas implacáveis, valquírias, górgonas e monstros chefes de alta dificuldade." },
  { name: "Botania", category: "Magia Natural", description: "Gere Mana através de flores místicas e forje equipamentos com Lingotes de Terrasteel." },
  { name: "Thaumic Tinkerer", category: "Expansão Arcana", description: "Adiciona a lendária Kami Armor, ferramentas de ichor e o Infused Crops ao Thaumcraft." },
  { name: "Forbidden Magic", category: "Magia Proibida", description: "Integração profunda entre Thaumcraft, Blood Magic e Botania com feitiços corrompidos." },
  { name: "Applied Energistics 2 (Classic)", category: "Armazenamento ME", description: "Redes digitais clássicas do 1.7.10 com cabos de fibra e autocrafting automatizado." },
  { name: "Ender IO (Classic)", category: "Cabos Compactos", description: "Conduítes no mesmo bloco para itens, energia, fluidos e redstone com spawner elétrico." },
  { name: "Thermal Expansion", category: "Indústria & Máquinas", description: "Fornos de indução, pulverizadores, dínamos de vapor e ligas de enderium." },
  { name: "Thermal Dynamics", category: "Dutos de Fluidos & Energia", description: "Tubulações de cryotheum, pyrotheum e fluxducts com transferência ilimitada." },
  { name: "Thermal Foundation", category: "Metais & Recursos", description: "Ligas metálicas essenciais como Invar, Electrum, Signalum, Enderium e Lumium." },
  { name: "Iron Chests", category: "Armazenamento", description: "Baús expansíveis de Ferro, Ouro, Diamante, Cristal e Obsidian." },
  { name: "Not Enough Items (NEI)", category: "Guia de Receitas", description: "Interface visual para consulta instantânea de receitas e utilidades de cada item." },
  { name: "Waila (What Am I Looking At)", category: "Identificador HUD", description: "Exibe o nome do bloco, mod correspondente e status de energia em tempo real." },
  { name: "JourneyMap (Classic)", category: "Minimapa & Radar", description: "Mapeamento em tempo real com waypoints, mapa de cavernas e radar de criaturas." },
  { name: "Chisel 2", category: "Construção Arquitetônica", description: "Cinzel clássico com milhares de variações estéticas para blocos medievais e góticos." },
  { name: "Carpenter's Blocks", category: "Design Personalizado", description: "Blocos inclinados, rampas, portas e barreiras com texturas personalizadas." },
  { name: "Storage Drawers", category: "Gaveteiros", description: "Gavetas de madeira de alta densidade com upgrades de armazenamento massivo." },
  { name: "Extra Utilities", category: "Utilidades & Energia", description: "Geradores de lava, tambores de fluidos, anéis angelicais de voo e a dimensão Deep Dark." },
  { name: "MineFactory Reloaded", category: "Automação Agrícola", description: "Plantadores e colhedores automáticos, ordenhadores e usinas de processamento." },
  { name: "Biomes O' Plenty (Classic)", category: "Biomas & Natureza", description: "Mais de 70 biomas deslumbrantes com novas árvores, flores, gemas e pedras." },
  { name: "FastCraft", category: "Otimização 1.7.10", description: "Motor de aceleração gráfica que melhora drasticamente o FPS e reduz travamentos no Forge 1.7.10." },
  { name: "Inventory Tweaks", category: "Organização de Inventário", description: "Organize seus baús e inventário com um único clique ou tecla de atalho R." },
  { name: "Mouse Tweaks", category: "Facilidade de Controle", description: "Arraste itens rapidamente pelos slots segurando o botão do mouse." },
  { name: "Mantle", category: "Biblioteca Base", description: "Biblioteca central necessária para o suporte do Tinkers' Construct e Natura." },
  { name: "Natura", category: "Flora & Fauna", description: "Árvores gigantes de eucalipto, arbustos de bagas no Nether e nuvens saltitantes." },
  { name: "Baubles", category: "Amuletos & Joias", description: "Slots dedicados de anéis, cintos e amuletos mágicos para o jogador." },
  { name: "Custom NPCs", category: "Criação de Missões", description: "Adiciona NPCs customizados com diálogos de RPG, comerciantes e missões." }
];

const outPath = path.join(__dirname, '../src/renderer/assets/forbidden_full_mods.json');
fs.writeFileSync(outPath, JSON.stringify(forbiddenMods, null, 2), 'utf8');
console.log('Arquivo forbidden_full_mods.json gerado com sucesso!');
