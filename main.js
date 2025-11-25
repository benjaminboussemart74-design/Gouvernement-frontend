//
// Script principal de la one-page gouvernementale.
// Chaque fonction est documentée en français pour une lecture pédagogique.
//
import { supabase } from "./supabaseClient.js";

const gridContainer = document.getElementById("members-grid");
const sheetPanel = document.getElementById("sheet-panel");
const loaderTemplate = document.getElementById("loader-template");
const introButton = document.getElementById("toggle-intro");
const introContent = document.getElementById("intro-content");

// Fonction utilitaire : clone et renvoie le loader commun.
function createLoader() {
  return loaderTemplate.content.firstElementChild.cloneNode(true);
}

// Fonction utilitaire : applique un raccourci texte.
function truncate(text, max = 120) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Fonction utilitaire : récupère la photo ou un placeholder par défaut.
function getPhoto(url) {
  return url || "https://via.placeholder.com/400x260?text=Portrait";
}

// Fonction d'initialisation : charge les membres et active le comportement du paragraphe repliable.
async function initPage() {
  setupIntroToggle();
  gridContainer.innerHTML = "";
  gridContainer.appendChild(createLoader());

  try {
    const members = await loadGovernmentMembers();
    renderGrid(members);
  } catch (error) {
    console.error("Erreur lors du chargement des membres", error);
    gridContainer.innerHTML = "<p>Impossible de récupérer les données. Vérifiez votre connexion.</p>";
  }
}

// Fonction : active le bouton ouvrir/fermer pour le paragraphe introductif.
function setupIntroToggle() {
  introButton.addEventListener("click", () => {
    const isExpanded = introButton.getAttribute("aria-expanded") === "true";
    introButton.setAttribute("aria-expanded", String(!isExpanded));
    introButton.textContent = isExpanded ? "Ouvrir" : "Fermer";
    introContent.classList.toggle("collapsed", isExpanded);
  });
}

// Fonction : charge tous les membres du gouvernement avec leur ministère principal.
export async function loadGovernmentMembers() {
  const { data, error } = await supabase
    .from("persons")
    .select(`
      id, full_name, photo_url, role, description, cabinet_role, cabinet_order,
      person_ministries (
        ministry_id,
        is_primary,
        role_label,
        ministries (
          id, name, short_name, category
        )
      )
    `);

  if (error) throw error;
  const persons = data || [];

  // Tri des membres par rôle pour organiser la grille.
  const president = persons.find((p) => p.role?.toLowerCase() === "président");
  const primeMinister = persons.find((p) => p.role?.toLowerCase().includes("premier"));
  const others = persons.filter(
    (p) => p !== president && p !== primeMinister && p.role?.toLowerCase().includes("ministre")
  );
  others.sort((a, b) => {
    const orderA = a.cabinet_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.cabinet_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.full_name.localeCompare(b.full_name);
  });

  // Ajout du ministère principal directement sur l'objet pour simplifier l'affichage.
  const addMinistry = (person) => {
    if (!person) return null;
    const primary = person.person_ministries?.find((m) => m.is_primary) || person.person_ministries?.[0];
    return {
      ...person,
      ministry: primary?.ministries,
      role_label: primary?.role_label,
    };
  };

  return {
    president: addMinistry(president),
    primeMinister: addMinistry(primeMinister),
    others: others.map(addMinistry),
  };
}

// Fonction : rend la grille principale en positionnant Président et Premier ministre en premier.
export function renderGrid(members) {
  gridContainer.innerHTML = "";

  const { president, primeMinister, others } = members;
  [president, primeMinister, ...others].forEach((member) => {
    if (!member) return;
    const card = renderMemberCard(member);
    gridContainer.appendChild(card);
  });
}

// Fonction : crée une carte de membre avec photo, nom et bouton d'action.
export function renderMemberCard(member) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <span class="role-tag">${member.role || "Rôle"}</span>
    <img src="${getPhoto(member.photo_url)}" alt="Portrait de ${member.full_name}">
    <div class="card-body">
      <h3>${member.full_name}</h3>
      <p class="ministry">${member.ministry?.short_name || member.role_label || "Ministère"}</p>
      <p>${truncate(member.description, 140)}</p>
      <button class="open-sheet" data-person="${member.id}">Voir ma fiche</button>
    </div>
  `;

  card.querySelector(".open-sheet").addEventListener("click", () => openMemberSheet(member.id));
  return card;
}

// Fonction : ouvre la fiche détaillée d'un membre en récupérant l'ensemble des données nécessaires.
export async function openMemberSheet(personId) {
  sheetPanel.classList.remove("hidden");
  sheetPanel.innerHTML = "";
  sheetPanel.appendChild(createLoader());

  try {
    const [personData, career, cabinet, poles] = await Promise.all([
      loadPersonDetails(personId),
      loadPersonCareer(personId),
      loadPersonCabinet(personId),
      loadPersonPoles(personId),
    ]);

    renderPersonSheet({ ...personData, career, cabinet, poles });
  } catch (error) {
    console.error("Erreur lors de l'ouverture de la fiche", error);
    sheetPanel.innerHTML = `<div class="panel"><p>Impossible d'afficher la fiche pour le moment.</p></div>`;
  }
}

// Fonction : ferme la fiche en masquant la modale.
export function closeMemberSheet() {
  sheetPanel.classList.add("hidden");
  sheetPanel.innerHTML = "";
}

// Fonction : rend le contenu complet d'une fiche (photo, bio, carrière, cabinet, pôles).
export function renderPersonSheet(person) {
  const panel = document.createElement("div");
  panel.className = "panel";

  panel.innerHTML = `
    <button class="close-btn" aria-label="Fermer" title="Fermer">✕</button>
    <header>
      <img src="${getPhoto(person.photo_url)}" alt="Portrait de ${person.full_name}">
      <div>
        <h2>${person.full_name}</h2>
        <p class="meta">${person.person_ministries?.[0]?.role_label || person.role}</p>
        <div>
          ${person.person_ministries?.map((m) => `<span class="badge">${m.ministries?.short_name || m.role_label}</span>`).join("") || ""}
        </div>
        <p>${person.description || "Aucune biographie courte renseignée."}</p>
      </div>
    </header>

    <section>
      <h3 class="section-title">Cabinet</h3>
      ${renderCabinet(person.cabinet)}
    </section>

    <section>
      <h3 class="section-title">Carrière</h3>
      ${renderCareer(person.career)}
    </section>

    ${person.poles?.length ? `<section><h3 class="section-title">Pôles</h3>${renderPoles(person.poles)}</section>` : ""}

    <div style="margin-top:1.5rem; display:flex; gap:0.6rem; flex-wrap:wrap;">
      <button class="export-btn" data-person="${person.id}">Exporter la fiche</button>
      <button class="close-btn-secondary">Fermer</button>
    </div>
  `;

  panel.querySelector(".close-btn").addEventListener("click", closeMemberSheet);
  panel.querySelector(".close-btn-secondary").addEventListener("click", closeMemberSheet);
  panel.querySelector(".export-btn").addEventListener("click", () => exportPersonSheet(person.id));
  sheetPanel.innerHTML = "";
  sheetPanel.appendChild(panel);
}

// Fonction : rend la liste du cabinet avec ordonnancement par grade.
function renderCabinet(cabinet = []) {
  if (!cabinet.length) return "<p>Aucun collaborateur renseigné.</p>";
  const items = cabinet
    .map((person) => {
      const grade = person.collab_grades?.label || person.cabinet_role || "Collaborateur";
      return `<li><strong>${person.full_name}</strong> — ${grade}${person.description ? ` : ${person.description}` : ""}</li>`;
    })
    .join("");
  return `<ul class="cabinet-list">${items}</ul>`;
}

// Fonction : rend la biographie détaillée année par année.
function renderCareer(career = []) {
  if (!career.length) return "<p>Aucune expérience renseignée.</p>";
  const items = career
    .map((event) => {
      const period = event.event_date || event.start_date || "Date non précisée";
      const title = event.event_text || event.title || "Mission";
      const organisation = event.organisation ? ` — ${event.organisation}` : "";
      return `<li><strong>${period}</strong> : ${title}${organisation}</li>`;
    })
    .join("");
  return `<ul class="career-list">${items}</ul>`;
}

// Fonction : rend les pôles pour le Président ou le Premier ministre.
function renderPoles(poles = []) {
  const list = poles
    .map((pole) => {
      const members = pole.subordinates
        ?.map(
          (m) =>
            `<li>${m.full_name} <span class="meta">${m.cabinet_role || m.collab_grades?.label || m.role || "Membre"}</span></li>`
        )
        .join("") || "<li>Aucun membre listé.</li>";
      return `
        <article class="pole">
          <h4>${pole.full_name}</h4>
          <p class="chef">${pole.cabinet_role || pole.collab_grades?.label || "Chef de pôle"}</p>
          <ul>${members}</ul>
        </article>
      `;
    })
    .join("");
  return `<div class="poles">${list}</div>`;
}

// Fonction : récupère les informations détaillées d'une personne.
export async function loadPersonDetails(personId) {
  const { data, error } = await supabase
    .from("persons")
    .select(`
      id, full_name, photo_url, role, description, superior_id,
      person_ministries (
        ministry_id,
        is_primary,
        role_label,
        ministries ( id, name, short_name, category )
      )
    `)
    .eq("id", personId)
    .single();

  if (error) throw error;
  return data;
}

// Fonction : récupère la carrière détaillée ordonnée.
export async function loadPersonCareer(personId) {
  const { data, error } = await supabase
    .from("person_careers")
    .select("id, person_id, event_date, start_date, end_date, event_text, title, organisation, sort_index")
    .eq("person_id", personId)
    .order("sort_index", { ascending: true, nullsLast: true })
    .order("event_date", { ascending: false, nullsLast: true });

  if (error) throw error;
  return data || [];
}

// Fonction : récupère le cabinet d'une personne en ordonnant par grade puis ordre personnalisé.
export async function loadPersonCabinet(personId) {
  const { data, error } = await supabase
    .from("persons")
    .select(`
      id, full_name, role, photo_url, description, cabinet_role, cabinet_order, collab_grade,
      collab_grades ( label, precedence )
    `)
    .eq("superior_id", personId)
    .order("precedence", { foreignTable: "collab_grades", ascending: true, nullsLast: true })
    .order("cabinet_order", { ascending: true, nullsLast: true });

  if (error) throw error;
  return data || [];
}

// Fonction : récupère les pôles (et leurs membres) pour un Président ou Premier ministre.
export async function loadPersonPoles(personId) {
  // Les chefs de pôle sont modélisés comme des personnes du cabinet avec un rôle/grade
  // spécifique (ex. cabinet_role ou grade contenant « pôle »). On filtre donc sur ces
  // attributs plutôt que sur un rôle métier générique.
  const { data, error } = await supabase
    .from("persons")
    .select(`
      id, full_name, description, photo_url, cabinet_role, role, collab_grade,
      collab_grades ( label ),
      subordinates:persons!superior_id (
        id, full_name, role, cabinet_role, photo_url, description, collab_grade,
        collab_grades ( label )
      )
    `)
    .eq("superior_id", personId)
    .or("cabinet_role.ilike.%pôle%,collab_grades.label.ilike.%pôle%")
    .order("full_name", { ascending: true });

  if (error) throw error;

  const isPoleLeader = (person) => {
    const label = person.collab_grades?.label?.toLowerCase() || "";
    const role = person.cabinet_role?.toLowerCase() || "";
    return label.includes("pôle") || role.includes("pôle");
  };

  return (data || []).map((pole) => ({
    ...pole,
    // Retire les éventuels chefs de pôle imbriqués de la liste des membres pour
    // ne conserver que les collaborateurs du pôle.
    subordinates: pole.subordinates?.filter((member) => !isPoleLeader(member)) || [],
  }));
}

// Fonction : exporte la fiche courante (placeholder simple via impression navigateur).
export function exportPersonSheet(personId) {
  console.info("Export de la fiche", personId);
  window.print();
}

// Écouteur global pour fermer la fiche lorsque l'utilisateur clique sur l'arrière-plan.
sheetPanel.addEventListener("click", (event) => {
  if (event.target === sheetPanel) {
    closeMemberSheet();
  }
});

// Lancement initial une fois le DOM prêt.
document.addEventListener("DOMContentLoaded", initPage);
