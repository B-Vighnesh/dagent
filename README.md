# Dagent

Dagent is a project exploring how a browser tool could help people spot manipulative wording and design on websites. The idea is to scan visible page content, identify possible dark patterns, and explain what may be pressuring or confusing a user.

**The live detection model has not been deployed.** The trained models are large, and the project did not have the funding needed to host them. The frontend is therefore a demonstration of the product idea: its scan preview uses prepared examples and simulated results. It does not scan the website you are visiting or call the detection API. The pages show the direction we hope to build toward if we can make the model smaller and find a sustainable way to run it.

## What the demo shows

The React website introduces the dark pattern problem, gives examples of pattern categories, and presents a simulated shopping page on the **Scan** screen. Scroll through the page to see sample alerts for wording such as low-stock claims, countdowns, and cancellation friction. These examples are written into the frontend; they are not live model predictions.

The site also includes **Download** and **Feedback** pages. These are part of the concept and prototype experience, not evidence that a fully hosted detector is available for everyday use.

## The planned detection workflow

The repository contains an early implementation of the system we intend to build:

1. A browser extension gathers visible text from page headings and paragraphs.
2. A FastAPI service splits the text into sentences and runs it through two DistilBERT models: one to flag possible dark patterns, and another to predict a category.
3. If configured, an optional Groq step can review model candidates.
4. The extension can show the flagged sentence and its predicted category.

This describes the planned and partially prototyped architecture. Because the models are not deployed, the frontend demo does not currently use this workflow. Running the API locally also requires the separately supplied model files.

## Repository map

| Folder | What you'll find |
| --- | --- |
| `dagent_api/` | FastAPI application and inference pipeline prototype |
| `dagent_extension/` | Chrome Manifest V3 extension prototype |
| `dagent_frontend_ui/` | React and Vite website, including the simulated scan demo |
| `dagnet_training/` | Training notebook and dataset |
| `dagent_docs/` | Project documentation, architecture notes, design materials, and copies of training resources |
| `dagent_models/` | Reserved for model files; ignored by Git |

## Run the frontend demo

```powershell
cd dagent_frontend_ui
npm install
npm run dev
```

Vite will print the local address after startup. The **Scan** page runs its prepared simulation locally in the frontend; it does not need the API or model weights. To create a production build, run `npm run build` from `dagent_frontend_ui/`.

## About the API prototype

The API model folder is empty in Git because the trained model files are too large to store in the repository. Download the model files from [this Google Drive folder](https://drive.google.com/drive/folders/1RJFFZU4_VKOmU0d6JxKUz0t0DvrIS4ou?usp=sharing) and place the two model folders here:

```text
dagent_api/models/dark_pattern_stage1_binary/
dagent_api/models/dark_pattern_stage2_category/
```

After downloading and placing both model folders, you can explore the backend prototype. Install dependencies from `dagent_api/` and start the service:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload --port 8000
```

The API documentation is available at `http://localhost:8000/docs` when it starts successfully. Without both model directories, it cannot perform inference. The extension currently targets `http://localhost:8000`; it is not connected to the frontend demo.

The API can optionally send candidate sentences and the page URL to Groq for a second opinion when configured. Keep that data flow in mind before using the prototype with real browsing content. Configuration options are in `dagent_api/app/config.py`.

## Training and future direction

`dagnet_training/dagent_training.ipynb` contains the training workflow, and `dagnet_training/dagent_dataset.csv` contains the dataset. The docs in `dagent_docs/` describe the project background and architecture.

A key future goal is to reduce the model's size and cost enough to make deployment practical. The longer-term vision described in the project materials is on-device detection, which could keep page text in the browser. That work depends on making the model efficient and securing the resources needed to develop and support it.

## Further reading

- [API prototype setup](dagent_api/README.md)
- [Frontend notes](dagent_frontend_ui/README.md)
- [Project documentation](dagent_docs/dagent_documentation.md)
- [Extension architecture notes](dagent_docs/dagent_architecture_1)




