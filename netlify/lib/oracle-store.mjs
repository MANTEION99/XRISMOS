// Αποθήκη των χρησμών του κοινού μηχανισμού (ένα έγγραφο ανά χρησμό ή ερώτηση).
import { getStore } from "@netlify/blobs";
export const oracleStore = () => getStore({ name: "oracle-readings", consistency: "strong" });
export const emailsStore = () => getStore({ name: "free-teaser-emails", consistency: "strong" });
