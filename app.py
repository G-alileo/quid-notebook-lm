import streamlit as st

def main():
    st.set_page_config(page_title="Quid Notebook Deprecated", page_icon="📓")
    st.warning("### 📓 Streamlit Frontend Deprecated")
    st.markdown(
        """
        The Streamlit application has been sunset and replaced with a custom, high-performance
        **React SPA + Vite + TailwindCSS** frontend and **FastAPI** backend unified architecture.
        
        #### How to run the new application:
        
        1. **Start the FastAPI Backend**:
           ```bash
           # Activate virtual environment and run main:
           uv run python main.py
           ```
           
        2. **Start the React Frontend**:
           ```bash
           # In another terminal window:
           cd frontend
           npm run dev
           ```
           
        3. Open **`http://localhost:5173`** in your browser.
        """
    )

if __name__ == "__main__":
    main()
