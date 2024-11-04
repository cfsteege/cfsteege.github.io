const teamMap = {};
const playerMap = {};
const gameMap = {};

window.addEventListener('DOMContentLoaded', async function () {
  // Create the initial empty plots once the DOM loads
  plotGameData([])
  plotSeasonData([])

  // Setup tab switching
  document.getElementById("game-tab").addEventListener("click", () => { switchTab("game") });
  document.getElementById("season-tab").addEventListener("click", () => { switchTab("season") });

  // Load data from JSON files
  await loadTeamData();
  await loadPlayerData();
  await loadGameData();

  const gameTeamSelect = document.getElementById("game-team-select")
  const seasonTeamSelect = document.getElementById("season-team-select")
  const teamEntries = Object.entries(teamMap).sort(([abbrev1, team1], [abbrev2, team2]) => {
    return team1.name.localeCompare(team2.name);
  });

  for (const [abbrev, team] of teamEntries) {
    const option1 = document.createElement("option");
    option1.value = abbrev;
    option1.textContent = team.name;
    gameTeamSelect.appendChild(option1);
    const option2 = document.createElement("option");
    option2.value = abbrev;
    option2.textContent = team.name;
    seasonTeamSelect.appendChild(option2);
  };

  handleSeasonTeamSelect();

  // Set up event listeners once data is fetched
  gameTeamSelect.addEventListener("change", filterGames);
  document.getElementById("start-date").addEventListener("change", filterGames);
  document.getElementById("end-date").addEventListener("change", filterGames);
  seasonTeamSelect.addEventListener("change", handleSeasonTeamSelect);
  document.getElementById("season-player-select").addEventListener("change", handleSeasonPlayerSelect);

  // filter out games with no coords: add attribute to gameMap like validCoords
  // fix tooltip
  // Add team vs team and date info to events for player season plot tooltip

  // When all teams, show player type select, shots/goals toggle
  // When specfic team, show player select, shots/goal toggle
  // When specific team and specific player show shot/goal toggle

});

async function loadTeamData() {
  try {
    const response = await fetch('teamData.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    Object.assign(teamMap, data);
  } catch (error) {
    console.error('Error loading team data:', error);
  }
}

async function loadPlayerData() {
  try {
    const response = await fetch('playerData.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    Object.assign(playerMap, data);
  } catch (error) {
    console.error('Error loading player data:', error);
  }
}

async function loadGameData() {
  try {
    const response = await fetch('gameData.json');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    Object.assign(gameMap, data);
  } catch (error) {
    console.error('Error loading game data:', error);
  }
}

function switchTab(tab) {
  // Toggle tab active states
  document.getElementById('game-tab').classList.toggle('active', tab === 'game');
  document.getElementById('season-tab').classList.toggle('active', tab === 'season');

  // Show/hide controls and plot panels
  document.getElementById('game-controls').classList.toggle('hidden', tab !== 'game');
  document.getElementById('season-controls').classList.toggle('hidden', tab !== 'season');
  document.getElementById('game-plot-panel').classList.toggle('hidden', tab !== 'game');
  document.getElementById('season-plot-panel').classList.toggle('hidden', tab !== 'season');
}

// filter games and display the game list
function filterGames() {
  const selectedTeam = document.getElementById("game-team-select").value;
  const startDate = new Date(document.getElementById("start-date").value);
  const endDate = new Date(document.getElementById("end-date").value);

  const gameListContainer = document.getElementById("game-list");
  gameListContainer.innerHTML = "";

  // TODO: allow filtering on date range only (no team) as well?
  if (selectedTeam) {
    const filteredGames = teamMap[selectedTeam].games.filter(game => {
      const gameDate = new Date(game.date);
      return (!isNaN(startDate) ? gameDate >= startDate : true) &&
        (!isNaN(endDate) ? gameDate <= endDate : true);
    });

    if (filteredGames.length > 0) {
      filteredGames.forEach(game => {
        const gameElement = document.createElement("div");
        gameElement.className = "game-element";
        gameElement.textContent = `${selectedTeam} vs ${game.opponent} - ${game.date}`;
        gameElement.style.cursor = "pointer";
        gameElement.addEventListener("click", () => handleGameSelect(game.gameId, selectedTeam));
        gameListContainer.appendChild(gameElement);
      });
    } else {
      const gameListText = document.createElement("div");
      gameListText.className = "game-list-text";
      gameListText.innerHTML = "No games found."
      gameListContainer.appendChild(gameListText);
    }
  }
  else {
    const gameListText = document.createElement("div");
    gameListText.className = "game-list-text";
    gameListText.innerHTML = "Select a team."
    gameListContainer.appendChild(gameListText);
  }
}

// filter events based on the selected period and player
function filterEvents(events) {
  const selectedPeriod = document.getElementById("periodFilter").value;
  const selectedPlayer = document.getElementById("playerFilter").value;

  const filteredEvents = events.filter(event => {
    const periodMatches = selectedPeriod ? event.periodDescriptor.number == Number(selectedPeriod) : true;
    const playerMatches = selectedPlayer ? event.playerId == selectedPlayer : true;
    return periodMatches && playerMatches;
  });

  return filteredEvents
}

let controller = new AbortController();

async function populateIndividualGameFilters(eventData, periods, teamAbbrev) {
  const playerDropdown = document.getElementById("playerFilter");
  const periodDropdown = document.getElementById("periodFilter");

  // Clear existing options
  periodDropdown.innerHTML = '<option value="">All Periods</option>';
  playerDropdown.innerHTML = '<option value="">All Players</option>';

  // Cancel previous change listeners
  controller.abort();
  controller = new AbortController();

  for (let period = 1; period <= periods; period++) {
    const option = document.createElement("option");
    option.value = period;
    option.textContent = period;
    periodDropdown.appendChild(option);
  }

  // Collect unique players from eventData
  const uniquePlayers = [...new Set(eventData.map(event => { return { "id": event.playerId, "team": event.teamAbbrev } }))];
  const playerOptions = [];
  for (const player of uniquePlayers) {
    const playerInfo = playerMap[player.id];
    if (playerInfo)
      playerOptions.push({
        ...player,
        "name": `${playerInfo.firstName} ${playerInfo.lastName}`
      })
  }

  playerOptions.sort((player1, player2) => {
    const isSelectedTeam1 = player1.team === teamAbbrev;
    const isSelectedTeam2 = player2.team === teamAbbrev;

    if (isSelectedTeam1 && !isSelectedTeam2) return -1;
    if (!isSelectedTeam1 && isSelectedTeam2) return 1;

    return player1.name.localeCompare(player2.name);
  });

  for (const playerOption of playerOptions) {
    const option = document.createElement("option");
    option.value = playerOption.id;
    option.textContent = `${playerOption.name} (${playerOption.team})`;
    playerDropdown.appendChild(option);
  };

  // Event listeners to update plot on filter change
  playerDropdown.addEventListener("change", () => {
    const filteredEvents = filterEvents(eventData);
    // TODO: maybe update the periods filter?
    plotGameData(filteredEvents);
  }, { signal: controller.signal });

  periodDropdown.addEventListener("change", () => {
    const filteredEvents = filterEvents(eventData);
    // TODO: maybe update the player filter?
    plotGameData(filteredEvents);
  }, { signal: controller.signal });
}

// Fetch game data and update D3 plot
function handleGameSelect(gameId, homeTeamAbbrev) {
  const gameData = gameMap[gameId];
  const teamHeader = document.getElementById("game-header");
  teamHeader.innerHTML = `${gameData.homeTeam} vs. ${gameData.awayTeam}: ${gameData.date}`;
  populateIndividualGameFilters(gameData.events, gameData.periods, homeTeamAbbrev);
  plotGameData(gameData.events);
}

function handleSeasonTeamSelect() {
  const selectedTeam = document.getElementById("season-team-select").value;
  console.log(selectedTeam);

  const events = selectedTeam ? getEventsForTeam(selectedTeam) : Object.values(gameMap).flatMap(game => game.events);
  const shotEvents = events.filter(event => event.typeDescKey === "shot-on-goal");
  const goalEvents = events.filter(event => event.typeDescKey === "goal")

  const shotsButton = document.getElementById("shots-btn");
  const goalsButton = document.getElementById("goals-btn");
  shotsButton.classList.remove("hidden");
  goalsButton.classList.remove("hidden");

  if (goalsButton.classList.contains("active")) {
    document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Goals` : "Entire League Goals";
    plotSeasonData(goalEvents)
  } else if (shotsButton.classList.contains("active")) {
    document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Shots` : "Entire League Shots";
    plotSeasonData(shotEvents)
  }

  // Cancel previous change listeners
  controller.abort();
  controller = new AbortController();

  goalsButton.addEventListener("click", () => {
    if (!goalsButton.classList.contains("active")) {
      document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Goals` : "Entire League Goals"
      goalsButton.classList.add("active");
      shotsButton.classList.remove("active");
      plotSeasonData(goalEvents)
    }
  }, { signal: controller.signal })
  shotsButton.addEventListener("click", () => {
    if (!shotsButton.classList.contains("active")) {
      document.getElementById("season-header").innerHTML = selectedTeam ? `${teamMap[selectedTeam].name} Shots` : "Entire League Shots"
      goalsButton.classList.remove("active");
      shotsButton.classList.add("active");
      plotSeasonData(shotEvents)
    }
  }, { signal: controller.signal })

  const playerSelect = document.getElementById("season-player-select");
  playerSelect.innerHTML = '<option value="">All Players</option>';

  if (selectedTeam) {
    const playerOptions = teamMap[selectedTeam].playerIds.map(id => {
      const player = playerMap[id];
      return {
        "id": id,
        "name": `${player.firstName} ${player.lastName}`
      }
    }).sort((p1, p2) => p1.name.localeCompare(p2.name))
    console.log(playerOptions)
    for (const playerOption of playerOptions) {
      const option = document.createElement("option");
      option.value = playerOption.id;
      option.textContent = playerOption.name;
      playerSelect.appendChild(option);
    }
  }
}

// Function to get all events for a team
const getEventsForTeam = (abbrev) => {
  const team = teamMap[abbrev];
  return team.games
    .flatMap(game => gameMap[game.gameId]?.events || []).filter(event => event.teamAbbrev == abbrev);
};

function handleSeasonPlayerSelect() {
  const selectedPlayer = document.getElementById("season-player-select").value;
  if (!selectedPlayer) {
    handleSeasonTeamSelect();
  } else {
    document.getElementById("shots-btn").classList.add("hidden");
    document.getElementById("goals-btn").classList.add("hidden");
    document.getElementById("season-header").innerHTML = `${playerMap[selectedPlayer].firstName} ${playerMap[selectedPlayer].lastName} Shots and Goals`;
    plotSeasonPlayerData(getEventsForPlayer(selectedPlayer));
  }
}

function getEventsForPlayer(id) {
  const playerId = Number(id);
  const events = [];
  for (const [abbrev, team] of Object.entries(teamMap)) {
    if (team.playerIds.includes(playerId)) {
      events.push(...getEventsForTeam(abbrev).filter(event => event.playerId == id));
    }
  }
  return events;
};

const plotWidth = 800;
const plotHeight = 340;
const margin = { top: 0, right: 0, bottom: 0, left: 0 };

const x = d3.scaleLinear()
  .domain([-100, 100])
  .range([0, plotWidth]);
const y = d3.scaleLinear()
  .domain([-42.5, 42.5])
  .range([plotHeight, 0]);

function plotGameData(goalAndShotEvents) {
  d3.select("#game-d3-plot").selectAll("*").remove();

  const svg = d3.select("#game-d3-plot")
    .append("svg")
    .attr("width", plotWidth + margin.left + margin.right)
    .attr("height", plotHeight + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("image")
    .attr("xlink:href", "images/rink.jpeg")
    .attr("x", x(-100))
    .attr("y", y(42.5))
    .attr("width", x(100) - x(-100))
    .attr("height", y(-42.5) - y(42.5));

  var tooltip = d3.select("#game-tooltip");

  svg.selectAll("circle")
    .data(goalAndShotEvents.filter(event => event.typeDescKey == "shot-on-goal"))
    .enter()
    .append("circle")
    .attr("cx", event => x(event.details.xCoord))
    .attr("cy", event => y(event.details.yCoord))
    .attr("r", 4)
    .style("fill", event => getColor(event.isHomeTeam))
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue")
      showToolTip(event, this.getBoundingClientRect());
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black")
      tooltip.style("visibility", "hidden");
    })

  svg.selectAll("path")
    .data(goalAndShotEvents.filter(event => event.typeDescKey == "goal"))
    .enter()
    .append("path")
    .attr("d", d3.symbol().type(d3.symbolCross).size(80))
    .attr("transform", event => `translate(${x(event.details.xCoord)}, ${y(event.details.yCoord)}) rotate(45)`)
    .style("fill", event => getColor(event.isHomeTeam))
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue");
      showToolTip(event, this.getBoundingClientRect())
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black");
      tooltip.style("visibility", "hidden");
    });

  function getColor(isHomeTeam) {
    return isHomeTeam ? "yellow" : "#c772fc"
  }

  function showToolTip(event, position) {
    tooltip.style("visibility", "visible")
      .html(`
        ${event.typeDescKey === "goal" ? "<b>Goal</b>" : "<b>Shot on Goal</b>"}
        <br>Player: ${playerMap[event.playerId].firstName} ${playerMap[event.playerId].lastName}
        <br>Team: ${event.teamName}
        <br>Period: ${event.periodDescriptor.number}
        <br>Time Into Period: ${event.timeInPeriod}
        <br>Shot type: ${String(event.details.shotType).charAt(0).toUpperCase() + String(event.details.shotType).slice(1)}
      `)
      .style("top", (position.bottom + window.scrollY) + "px")
      .style("left", (position.right + window.scrollX) + "px")
      .style("background", getColor(event.isHomeTeam));
  }
}

function plotSeasonData(events) {
  d3.select("#season-d3-plot").selectAll("*").remove();

  // TODO: add heatmap color legend!

  const svg = d3.select("#season-d3-plot")
    .append("svg")
    .attr("width", plotWidth + margin.left + margin.right)
    .attr("height", plotHeight + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("image")
    .attr("xlink:href", "images/rink.jpeg")
    .attr("x", x(-100))
    .attr("y", y(42.5))
    .attr("width", x(100) - x(-100))
    .attr("height", y(-42.5) - y(42.5));

  // compute the density data
  var densityData = d3.contourDensity()
    .x(event => x(event.details.xCoord))
    .y(event => y(event.details.yCoord))
    .size([plotWidth, plotHeight])
    .bandwidth(4)
    (events)

  const meanDensity = d3.mean(densityData, d => d.value);
  const stdDevDensity = d3.deviation(densityData, d => d.value);
  console.log(stdDevDensity / meanDensity);
  console.log(stdDevDensity);

  const maxDensityValue = meanDensity + 0.5 * stdDevDensity;
  const minDensityValue = 0.001 * stdDevDensity;
  console.log(minDensityValue)

  const colorScale = d3.scaleSequential(d3.interpolatePlasma)
    .domain([minDensityValue, maxDensityValue]); // Adjust to your actual max density

  // Function to determine color with transparency based on density
  function getColor(density) {
    // Get the base color from the color scale
    const color = d3.color(colorScale(density));

    // Set opacity proportional to the density value
    color.opacity = d3.scaleLinear()
      .domain([minDensityValue, maxDensityValue])
      .range([0.1, 0.6])(density);

    return color;
  }

  // show the shape!
  svg.insert("g", "g")
    .selectAll("path")
    .data(densityData)
    .enter().append("path")
    .attr("d", d3.geoPath())
    .attr("fill", function (d) { return getColor(d.value); })
}

function plotSeasonPlayerData(goalAndShotEvents) {
  // TODO: add shot vs goals filter



  d3.select("#season-d3-plot").selectAll("*").remove();

  const svg = d3.select("#season-d3-plot")
    .append("svg")
    .attr("width", plotWidth + margin.left + margin.right)
    .attr("height", plotHeight + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("image")
    .attr("xlink:href", "images/rink.jpeg")
    .attr("x", x(-100))
    .attr("y", y(42.5))
    .attr("width", x(100) - x(-100))
    .attr("height", y(-42.5) - y(42.5));

  var tooltip = d3.select("#season-tooltip");

  svg.selectAll("circle")
    .data(goalAndShotEvents.filter(event => event.typeDescKey == "shot-on-goal"))
    .enter()
    .append("circle")
    .attr("cx", event => x(event.details.xCoord))
    .attr("cy", event => y(event.details.yCoord))
    .attr("r", 4)
    .style("fill", "#c772fc")
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue")
      showToolTip(event, this.getBoundingClientRect());
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black")
      tooltip.style("visibility", "hidden");
    })

  svg.selectAll("path")
    .data(goalAndShotEvents.filter(event => event.typeDescKey == "goal"))
    .enter()
    .append("path")
    .attr("d", d3.symbol().type(d3.symbolCross).size(80))
    .attr("transform", event => `translate(${x(event.details.xCoord)}, ${y(event.details.yCoord)}) rotate(45)`)
    .style("fill", "yellow")
    .style("stroke", "black")
    .on("mouseover", function (event) {
      d3.select(this).style("stroke", "blue");
      showToolTip(event, this.getBoundingClientRect())
    })
    .on("mouseout", function () {
      d3.select(this).style("stroke", "black");
      tooltip.style("visibility", "hidden");
    });

  function showToolTip(event, position) {
    tooltip.style("visibility", "visible")
      .html(`
        ${event.typeDescKey === "goal" ? "<b>Goal</b>" : "<b>Shot on Goal</b>"}
        <br>Player: ${playerMap[event.playerId].firstName} ${playerMap[event.playerId].lastName}
        <br>Team: ${event.teamName}
        <br>Period: ${event.periodDescriptor.number}
        <br>Time Into Period: ${event.timeInPeriod}
        <br>Shot type: ${String(event.details.shotType).charAt(0).toUpperCase() + String(event.details.shotType).slice(1)}
      `)
      .style("top", (position.bottom + window.scrollY) + "px")
      .style("left", (position.right + window.scrollX) + "px")
  }
}

