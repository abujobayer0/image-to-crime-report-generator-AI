import express, {} from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();
const app = express();
const port = 3000;
app.use(express.json({ limit: "20mb" }));
app.use(cors());
app.use(morgan("dev"));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
async function generateCrimeReport(detailedAnalysis) {
    const prompt = `
  **Crime Scene Report**  
  **Division:** ${detailedAnalysis.division}  
  **District:** ${detailedAnalysis.district}  
  **Crime Time:** ${detailedAnalysis.crime_time}  

  **Environment:** ${detailedAnalysis.environment}  
  **Actions & Movement:** ${detailedAnalysis.actions_movement}  
  **Objects & Items:** ${detailedAnalysis.objects_items}  
  **Suspects & Victims:** ${detailedAnalysis.suspects_victims}  
  **Evidence:** ${detailedAnalysis.evidence}  
  **Potential Motive:** ${detailedAnalysis.potential_motive}  

  **Detective’s Summary:**  
  ${detailedAnalysis.professional_report}  

  Generate a **100-word structured professional detective report** based on the above crime scene analysis.
  `;
    try {
        const response = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const reportText = response.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        return reportText || "Failed to generate a detailed report.";
    }
    catch (error) {
        console.error("Error generating crime report:", error.response?.data || error.message);
        return "Failed to generate a detailed report.";
    }
}
app.post("/api", async (req, res) => {
    const { imageUrl, district, division, crime_time } = req.body;
    if (!district || !division || !crime_time || !imageUrl) {
        return res.status(400).json({ error: "Missing required parameters" });
    }
    try {
        const response = await axios.post("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large", {
            inputs: imageUrl,
        }, {
            headers: {
                Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                "Content-Type": "application/json",
            },
        });
        const caption = response.data?.[0]?.generated_text ||
            "No crime-related details detected in the image.";
        const crimeDetails = {
            division: `${division} Division`,
            district: district,
            crime_time: crime_time,
            environment: "Urban area with varying levels of destruction, including damaged vehicles, broken infrastructure, and signs of chaos. The scene may involve ongoing protests, gang-related violence, or other disruptive events.",
            actions_movement: "A mix of violent confrontations, attempts to escape, and law enforcement attempting to restore order. People are seen running, fighting, or engaging in activities that suggest urgency and panic.",
            objects_items: "Damaged vehicles, broken glass, abandoned personal belongings, and other scattered items such as protest signs, debris, or weapons. Various items indicate a violent or chaotic event.",
            suspects_victims: "Multiple individuals are visibly distressed, some showing signs of injury or aggression. Suspects may include perpetrators engaged in the violence, while victims could include innocent bystanders or targets of the conflict.",
            evidence: "Traces of violence such as blood, footprints, abandoned personal belongings, weapons, and items that could be linked to the perpetrators or victims. Possible incendiary devices or signs of forced entry may also be present.",
            potential_motive: "The motive could range from political unrest, personal disputes, robbery, gang-related violence, or escalated protests. Other possibilities include retaliation, territorial conflict, or clashes sparked by external factors.",
            professional_report: caption,
        };
        const report = await generateCrimeReport(crimeDetails);
        res.status(200).json({
            image_caption: caption,
            generated_report: report,
        });
    }
    catch (error) {
        console.error("Error analyzing the crime scene:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to analyze the crime scene." });
    }
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});
