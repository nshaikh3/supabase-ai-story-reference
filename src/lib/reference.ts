import publication from "../../deployment/publication.json";

export const repositoryUrl: string | null = publication.repositoryUrl;

export const demoStory = {
  title: "Nova and the silver compass",
  hero: "Nova",
  idea: "A fictional explorer helps a fox find a moonlit garden.",
  pages: [
    {
      title: "A map in the moonlight",
      text: "Nova found a small silver map beside the window. Its winding path led toward a moonlit garden, where a little lantern had lost its light. With a notebook, a warm scarf, and a promise to be kind, our explorer stepped outside. The first star appeared, as if to say that every adventure begins with one careful step.",
    },
    {
      title: "A friend at the gate",
      text: "At the gate, Nova met a fox carrying an empty basket. The fox needed help collecting fallen leaves before the evening breeze arrived. Together they gathered red, gold, and copper leaves, leaving growing plants undisturbed. When the basket was full, the fox offered a tiny compass. Its needle pointed toward whoever needed a friend.",
    },
    {
      title: "The patient crossing",
      text: "The compass guided Nova to a narrow stream. A wooden bridge was missing one plank, and a rabbit waited on the other side. Instead of rushing across, the friends looked for a safe path around the water. They discovered smooth stepping stones in a shallow spot. Moving slowly together, they reached the bank with dry feet and happy smiles.",
    },
    {
      title: "What lights a lantern",
      text: "Deep inside the moonlit garden, Nova discovered the dark lantern resting beneath a tree. It did not need a flame. Around its base were pictures of helping hands, patient footsteps, and listening ears. The friends shared what they had learned along the way. A gentle golden glow filled the lantern, bright enough to show everyone the path home.",
    },
    {
      title: "The way home",
      text: "Back at the window, Nova placed the silver map inside the notebook. The adventure had taught a simple lesson: asking for help can be brave, and small acts of kindness can make a great difference. Outside, the lantern glimmered softly in the distance. Our explorer closed the notebook, ready to dream of another friendly adventure tomorrow.",
    },
  ],
} as const;

export const architectureSteps = [
  { number: "01", title: "Sign in", service: "Supabase Auth", description: "Email confirmation and server-verified sessions establish who is making a request. Private pages never rely on an unverified browser user object." },
  { number: "02", title: "Save a private draft", service: "Postgres + RLS", description: "A story has one owner. Pages, jobs and image metadata inherit that ownership through the story. Database policies apply to direct API calls too." },
  { number: "03", title: "Generate five pages", service: "Edge Functions", description: "The function verifies the caller and uses a narrow worker capability. The database admits one active job, enforces limits and saves completed pages atomically." },
  { number: "04", title: "Update open tabs", service: "Private Realtime Broadcast", description: "A private topic sends a small status hint. Each tab fetches the authorized database state. Reconnecting reconciles missed events without interval polling." },
  { number: "05", title: "Serve private illustrations", service: "Supabase Storage", description: "Owner-only uploads are bounded and normalized. Images are delivered through an authenticated, uncached route; the bucket is never made public." },
] as const;
