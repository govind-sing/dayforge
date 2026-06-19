from google import genai


client = genai.Client(
    api_key="AIzaSyDKZrDrFVbdL2_t2A-g82mGQjtk9haKB4g"
)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Where is Taj Mahal?"
)

print(response.text)