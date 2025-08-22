// import * as similarity from "compute-cosine-similarity";
const similarity = require('compute-cosine-similarity')

function getFullImagePath(req, folderName) {
  return (
    `https://election.prabhatkhabar.com/uploads/${folderName}/` +
    req.file.filename
  );
}

export async function getEmbedding(text: string, chatbotInstance: any, modelUsed: string): Promise<number[]> {
	try {
		let result;
		
		if(modelUsed === 'OPENAI'){
		  const response = await chatbotInstance.embeddings.create({
		    model: 'text-embedding-3-small',
		    input: text,
		    encoding_format: "float"
		  })
		  result = response.data[0].embedding
		}else{

		  const response = await chatbotInstance.models.embedContent({
		    model: "gemini-embedding-001",
		    contents: [text],
		  });
		  result = response.embeddings[0].values; // embedding vector
		}
		return result;
	} catch (error) {
		console.error("Error generating embedding:", error);
		throw error;
	}
}

export async function generateChatbotResponse(prompt: string, modelUsed: string, chatbotInstance: any): Promise<string>{
	let answer: string; 
	if(modelUsed === "OPENAI"){

		const response =  await chatbotInstance.response.create({
			model: process.env.OPENAI_MODEL as string,
			input: prompt
		})

		answer = response.output_text

	}else{

      const response = await this.electionChatbot.models.generateContent({
        model: process.env.GEMINI_MODEL as string,
        contents: [
          {
            role: "user",
            parts: [
              { text: `You are an election assistant. Only answer questions about the Bihar election. If the question is unrelated, politely refuse.\n\nUser question: ${prompt}` }
            ]
          }
        ]
      });

      const parts: any = response.candidates?.[0]?.content?.parts || [];
      answer = parts.map(p => p.text).join(" ") || "No response";
	}
	return answer

}

export function measureSimilarity(vecA: number[], vecB: number[]): number | null {
  return similarity(vecA, vecB);
}


const cachedKeys = {
  CANDIDATES: "candidates",
  CONSTITUENCY: "constituency",
  HOT_CANDIDATES: "hot_candidates",
  PARTY: "party",
  ASSEMBLY_ELECTION: "assembly_election",
  CN_LIST: "cn_list",
  STATE_ELECTION: "state_election",
  ELECTION: "election",
  WIDGET: "widget",
};

export { getFullImagePath, cachedKeys };
