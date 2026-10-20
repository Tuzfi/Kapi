# Kapi HVAC 2D - Calculadora de Carga Térmica & Simulação Dinâmica 24h

> **Versão:** `v0.1`  
> **Status:** Release Inicial  
> **Tecnologias:** JavaScript Moderno (ES Modules), HTML5 Canvas 2D, CSS3 Glassmorphism & Tokens, Python 3 (Engenharia de Testes)

---

## ❄️ Visão Geral

O **Kapi** é uma plataforma web interativa voltada para projetos de climatização e engenharia predial (HVAC). Ele combina um ambiente CAD 2D vetorial com um motor de balanço térmico instantâneo e simulação solar dinâmica hora a hora ao longo de 24 horas.

A metodologia de cálculo adota os fundamentos consagrados da engenharia térmica predial e das normas **ASHRAE**:
* **ASHRAE Standard 183:** Procedimentos de balanço térmico de pico para resfriamento e aquecimento.
* **ASHRAE Standard 90.1:** Parâmetros de desempenho de envoltória (valores U de paredes, coberturas e vidros, SHGC e densidades de potência de iluminação e equipamentos).
* **ASHRAE Standard 62.1:** Taxas de ventilação mecânica e renovação de ar externo na zona de respiração ($V_{oz} = R_p \cdot P + R_a \cdot A$).

---

## 🚀 Principais Funcionalidades

### 1. Modelagem Arquitetônica 2D & CAD
* **Navegação com Botão Direito:** Clique e arraste com o botão direito do mouse (ou botão do meio / Alt + clique esquerdo) para locomover e navegar livremente pelo plano do edifício.
* **Dimensionamento Preciso de Esquadrias:** Inserção e edição das dimensões exatas de cada janela (largura e altura em metros) com cálculo automático da área envidraçada e da relação vidro/parede (*Window-to-Wall Ratio*).
* **Orientação Solar & Rotação do Norte:** Controle fino do azimute do edifício (0° a 359°) via campos numéricos, botões incrementais ou arrastando a Rosa dos Ventos interativa. O cálculo da incidência solar em todas as fachadas é recalculado instantaneamente.
* **Busca e Filtro Rápido de Espaços:** Barra de pesquisa em tempo real para filtrar ambientes por nome ou por zona térmica, com métricas de área total e carga acumulada.

### 2. Motor Termofísico em Tempo Real
* **Temperatura Sol-Ar ($T_{sol-air}$):** Cálculo do ganho de calor solar absorvido nas paredes opacas e coberturas em função da absortância da cor do acabamento externo e do coeficiente de filme de ar superficial ($h_o$).
* **Radiação Fenestração:** Decomposição da radiação solar incidente em feixe direto normal, difuso da abóbada celeste e refletido pelo solo, aplicando o fator solar ($SHGC$) e coeficientes de atenuação interna por persianas/cortinas ($IAC$).
* **Balanço Sensível e Latente:**
  * Ocupação metabólica individualizada por tipo de atividade (escritório, reunião, academia, comércio).
  * Iluminação artificial e equipamentos de processo com cronogramas fracionários de operação.
  * Infiltração de ar exterior por renovações horárias ($ACH$).
  * Ventilação de ar novo com dimensionamento de vazão de ar exterior e desumidificação.

### 3. Simulação Dinâmica 24 Horas & Gráficos
* **Linha do Tempo com Reprodução Contínua:** Controle temporal com slider horário (00h às 23h) e botão Play/Pausar para acompanhar o ciclo solar diário.
* **Sol Dinâmico no Canvas 2D:** Rastreamento do vetor solar em tempo real (altitude e azimute astronômico) com destaque dourado nas fachadas iluminadas diretamente pelo sol.
* **Mapa de Calor Térmico (*Heatmap*):** Gradiente cromático por ambiente refletindo a carga térmica instantânea (salas a leste aquecem pela manhã, salas a oeste sofrem carga solar máxima no meio da tarde).
* **Curva de Carga Diária (SVG Interativo):** Gráfico horário da potência térmica com marcador dinâmico da hora atual, permitindo inspecionar o comportamento de cada espaço ou do edifício integrado.
* **Análise de Diversidade & Carga Coincidente (*Block Load*):** Comparação entre a soma das potências individuais de pico (*Non-Coincident Peak*) e o pico simultâneo da central de água gelada ou condensação (*Coincident Peak*), gerando o fator de diversidade real do projeto.

---

## 🏗️ Estrutura do Projeto

```
kapi/
├── index.html                   # Interface web principal (HTML5 semântico e responsivo)
├── styles.css                   # Sistema de design corporativo (tokens, glassmorphism)
├── src/
│   ├── app.js                   # Controlador central da aplicação web
│   ├── cad_canvas.js            # Renderizador CAD 2D, pan/zoom, Rosa dos Ventos e sol
│   ├── thermal_engine.js        # Motor termofísico (Sol-Air, balanço ASHRAE, ventilação)
│   ├── hourly_engine.js         # Simulação horária 24h, posições solares e diversidade
│   └── hap_library.js           # Bibliotecas de montagens, atividades e tipologias
├── tests/
│   ├── test_thermal.py          # Testes unitários do motor térmico
│   ├── test_spatial_search.py   # Testes de indexação espacial QuadTree e busca
│   └── test_e2e_ui.py           # Testes end-to-end com Playwright e captura visual
└── README.md                    # Documentação do projeto
```

---

## 💻 Como Executar

### Pré-requisitos
* Qualquer navegador web moderno com suporte a ES Modules e Canvas 2D (Chrome, Edge, Firefox, Safari).
* Python 3.8+ (opcional, para execução de servidor local e suíte de testes).

### Iniciando a Aplicação
Como o projeto utiliza módulos JavaScript nativos, execute um servidor HTTP simples na pasta raiz:

```bash
# Via Python
python -m http.server 8000

# Ou via Node.js
npx serve .
```

Abra o navegador no endereço:
```
http://localhost:8000
```

---

## 🧪 Suíte de Testes Automatizados

Para executar os testes unitários da engenharia térmica e da estrutura de dados:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

Para executar os testes visuais e de interação end-to-end (Playwright):

```bash
python tests/test_e2e_ui.py
```

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte o arquivo `LICENSE` para mais detalhes.
