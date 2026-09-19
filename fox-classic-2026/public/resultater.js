const filterKjonn = document.getElementById("filterKjonn");
const resultsContainer = document.getElementById("resultsContainer");

let participants = [];

async function loadResults() {
  participants = await fcFetchParticipants();
  render();
}

function render() {
  fcRenderResults(resultsContainer, participants, filterKjonn.value);
}

filterKjonn.addEventListener("change", render);

loadResults();
setInterval(loadResults, 20000);
