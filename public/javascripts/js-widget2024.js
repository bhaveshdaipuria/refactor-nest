let TOTAL_SEATS = 243;
let MAJORITY_MARK = 121;

async function getData() {
  try {
    const params = new URLSearchParams(document.location.search);
    let stateName = params.get("state") || "Bihar";
    stateName = stateName[0].toUpperCase() + stateName.slice(1);
    const year = params.get("year") || "2020";
    const type = params.get("type") || "general";
    const response = await fetch(
      `/elections/map/top-candidates?state=${stateName}&year=${year}&type=${type}`
    );
    let result = await response.json();
    TOTAL_SEATS = result.data.totalSeats;
    MAJORITY_MARK = result.data.halfWayMark;
    //console.log("This is just some result", result);

    return result;
  } catch (error) {
    console.error("Error fetching data:", error);
    // Mock data for testing
    return {
      parties: [
        { name: "JMM+", won: 45, leading: 0, partyColor: "#00FF00" },
        { name: "BJP+", won: 25, leading: 0, partyColor: "#FF9933" },
        { name: "JLKM", won: 6, leading: 0, partyColor: "#0000FF" },
        { name: "Others", won: 5, leading: 0, partyColor: "#808080" },
      ],
      declaredSeats: 81,
    };
  }
}

function getPartyTotal(party) {
  return party.seatsWon;
}

function getContenders(parties) {
  const partiesSeats = parties.map((party) => ({
    ...party,
    totalSeats: getPartyTotal(party),
  }));

  partiesSeats.sort((a, b) => b.totalSeats - a.totalSeats); // sort by decreasing order

  const contender1 = partiesSeats[0];
  const contender2 = partiesSeats[1];
  const otherContenders = partiesSeats.slice(2);
  const totalAllocatedSeats = parties.reduce(
    (sum, party) => sum + getPartyTotal(party),
    0
  );
  return { contender1, contender2, otherContenders, totalAllocatedSeats };
}

function calculateBarWidths(parties) {
  const totalSeats = TOTAL_SEATS;

  const { contender1, contender2, otherContenders, totalAllocatedSeats } =
    getContenders(parties);

  let widths = [];
  let currentPosition = 0;
  const blankSeats = totalSeats - totalAllocatedSeats;

  //console.log("left -->>>", currentPosition);

  // Add first contender to the left
  widths.push({
    party: contender1,
    width: (contender1.totalSeats / totalSeats) * 100,
    position: currentPosition,
  });

  //console.log("after left -->>>", currentPosition);

  // Add blank bar (if any) between "Other Parties" and BJP+
  if (blankSeats > 0) {
    // const blankWidth = (blankSeats / totalSeats) * 100;
    const blankWidth = 50;
    widths.push({
      party: { name: "Blank", partyColor: "#E0E0E0" }, // Gray for blank
      width: blankWidth,
      position: currentPosition,
    });
    currentPosition += blankWidth;
  }

  //console.log("after blank bar -->>>", currentPosition);

  // Add other parties in the middle
  otherContenders.forEach((party) => {
    const partyWidth = (party.totalSeats / totalSeats) * 100;
    widths.push({
      party: party,
      width: partyWidth,
      position: currentPosition,
    });
    currentPosition += partyWidth;
  });

  if (blankSeats > 0) {
    // const blankWidth = (blankSeats / totalSeats) * 100;
    const blankWidth = 50;
    widths.push({
      party: { name: "Blank", partyColor: "#E0E0E0" }, // Gray for blank
      width: blankWidth,
      position: currentPosition,
    });
    currentPosition += blankWidth;
  }

  //console.log("after adding middle -->>>", currentPosition);

  // Add second contender at the end
  widths.push({
    party: contender2,
    width: (contender2.totalSeats / totalSeats) * 100,
    position: currentPosition,
  });

  //console.log("after adding right -->>>", currentPosition);

  //console.log("widths -> ", widths);

  return widths;
}

async function updateResults() {
  const data = await getData();
  if (!data) return;

  //console.log("data -> ", data);

  let { contender1, contender2, otherContenders } = getContenders(
    data.data.parties
  );
  if (contender2.name === "AAP") {
    let temp = contender2;
    contender2 = contender1;
    contender1 = temp;
  }

  // Update party names and scores
  document.getElementById("contender1-name").textContent = contender1.partyName;
  document.getElementById("contender2-name").textContent = contender2.partyName;
  document.getElementById("others-name").textContent = "Others";

  document.getElementById("contender1-score").textContent =
    contender1.totalSeats;
  document.getElementById("contender1-score").style.color =
    contender1.partyColor;

  document.getElementById("contender2-score").textContent =
    contender2.totalSeats;
  document.getElementById("contender2-score").style.color =
    contender2.partyColor;

  document.getElementById("others-score").textContent = otherContenders.reduce(
    (sum, party) => sum + getPartyTotal(party),
    0
  );
  document.getElementById("others-score").style.color = "#37474F";

  // Calculate and update bars
  const barsContainer = document.getElementById("bars-container");
  barsContainer.innerHTML = ""; // Clear existing bars

  const barWidths = calculateBarWidths(data.data.parties);

  barWidths.forEach(({ party, width, position }) => {
    //console.log(barWidths);
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.backgroundColor = party.partyColor;
    bar.style.width = `${width}%`;
    barsContainer.appendChild(bar);
  });
}

// Initial update
updateResults();

// Update every 30 seconds
setInterval(updateResults, 30000);
