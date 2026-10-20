# Kapi - HVAC 2D Thermal Load Calculator & 24h Dynamic Solar Simulation

Clean-room reconstruction of **Carrier HAP 6.4** (Hourly Analysis Program) architectural search mechanisms, solar incidence algorithms, and 24-hour dynamic thermal simulation based on ASHRAE Standards 183 / 90.1 / 62.1.

---

## ☀️ Como o Carrier HAP 6.4 Calcula a Incidência Solar nas Paredes

A engenharia reversa nas bibliotecas [`HAPCore64.dll`](file:///C:/Program%20Files%20(x86)/Carrier%20HAP%206.4/HAPCore64.dll) e [`HAPDataHandler64.dll`](file:///C:/Program%20Files%20(x86)/Carrier%20HAP%206.4/HAPDataHandler64.dll) revelou as classes e fórmulas exatas utilizadas pelo HAP:

1. **Vetor Normal e Azimute da Parede ($\gamma$):**
   * Classe: `Carrier.HAP.Project.ExposureDirectionExtensions.SurfaceAzimuth`
   * Mapeia 16 direções de bússola em radianos (Sul = $0$, Leste = $\pi/2$, Norte = $\pi$, Oeste = $-\pi/2$).
   * Para cada segmento de parede no CAD 2D, calcula-se o vetor normal externo $(\Delta y, -\Delta x)$ e o azimute da parede $\gamma = \text{atan2}(n_x, n_y)$.

2. **Posição do Sol Hora a Hora ($\beta_s$, $\phi_s$):**
   * Classe: `Carrier.HAP.Configuration.Weather.DesignWeatherCalcs.CalcDesignSolar`
   * Ângulo Horário do Sol: $H = 15^\circ \times (t - 12)$
   * Altitude Solar ($\beta_s$): $\sin \beta_s = \cos(\text{Lat}) \cos \delta \cos H + \sin(\text{Lat}) \sin \delta$
   * Azimute Solar ($\phi_s$): $\cos \phi_s = \frac{\sin \beta_s \sin(\text{Lat}) - \sin \delta}{\cos \beta_s \cos(\text{Lat})}$

3. **Cosseno do Ângulo de Incidência Solar ($\cos \theta$):**
   $$\cos \theta = \cos \beta_s \cdot \cos(\phi_s - \gamma)$$
   * **Se $\cos \theta \le 0$:** A parede está auto-sombreada (na sombra). O feixe direto é zero ($I_{direto} = 0$), recebendo apenas radiação difusa do céu.
   * **Se $\cos \theta > 0$:** A parede está iluminada diretamente pelo feixe solar ($I_{direto} = I_{dn} \cdot \cos \theta$).

---

## 🚀 Recursos Interativos 24h & CAD do Kapi

* **Navegação com Botão Direito no Canvas 2D:** Clique e arraste com o botão direito do mouse (ou botão do meio / Alt+clique) para locomover e navegar livremente pelo projeto.
* **Janelas com Dimensões Customizáveis (Largura x Altura):** Defina a largura e altura exata de cada janela diretamente na parede via diálogo rápido ou no painel inspetor lateral, calculando a área envidraçada real e a taxa WWR (*Window-to-Wall Ratio*).
* **Orientação do Norte & Rotação do Mapa:** Rotacione o azimute do edifício (0° a 359°) através dos controles na barra superior ou arrastando diretamente a **Rosa dos Ventos (Compass Rose)** no canvas, atualizando instantaneamente os ângulos de incidência solar em todas as paredes.
* **Barra de Reprodução Temporal 24 Horas:** Slider interativo de $00:00$ às $23:00$ com botão **"Play/Pausar"** para ver o dia passando.
* **Sol Dinâmico no CAD 2D:**
  * O sol rotaciona visualmente ao redor do prédio com altitude e azimute reais corrigidos pela rotação do Norte.
  * Paredes atingidas pelo sol direto acendem em dourado/amarelo (`#e3b341`) com visualização de vidros duplos.
* **Mapa de Calor (Heatmap) Dinâmico:**
  * De manhã, as salas a **Leste** esquentam;
  * À tarde, as salas a **Oeste** sofrem o pico de calor;
  * À noite, as salas resfriam gradativamente.
* **Gráfico de Curva de Carga Horária 24h (SVG):**
  * Curva da carga térmica ao longo do dia para o prédio total ou para a sala selecionada, com marcador dinâmico da hora atual.
* **Cálculo da Diversidade e Pico Coincidente (*Block Load*):**
  * Descobre a **Hora de Pico Individual** de cada sala (ex: 10h para Leste, 16h para Oeste).
  * Descobre a **Hora de Pico Coincidente do Prédio** e a **Economia por Diversidade Horária** (evitando superdimensionar a máquina central).

---

## 🧪 Testes Automatizados no Backend Python

Execute:
```bash
python -m unittest discover -s tests -p "test_*.py"
```
Todos os 4 testes cobrindo busca alfanumérica, QuadTree espacial, posições solares e incidência solar em paredes são validados com sucesso.
