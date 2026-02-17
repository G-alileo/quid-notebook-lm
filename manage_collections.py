"""
Utility script to manage Milvus Cloud collections.
Use this to view and delete collections when you hit the 5 collection limit.
"""
import os
from dotenv import load_dotenv
from src.vector_database.milvus_vector_db import MilvusVectorDB

load_dotenv()

def list_all_collections():
    """List all collections in your Milvus Cloud database"""
    db = MilvusVectorDB(collection_name="temp_for_listing")
    collections = db.list_collections()
    
    print(f"\n{'='*60}")
    print(f"Found {len(collections)} collection(s) in your Milvus Cloud:")
    print(f"{'='*60}")
    
    for i, collection in enumerate(collections, 1):
        print(f"{i}. {collection}")
    
    print(f"\nMilvus Cloud Free Tier Limit: 5 collections")
    print(f"Current usage: {len(collections)}/5")
    print(f"{'='*60}\n")
    
    return collections

def delete_collection(collection_name: str):
    """Delete a specific collection"""
    db = MilvusVectorDB(collection_name=collection_name)
    
    confirm = input(f"\nAre you sure you want to delete '{collection_name}'? (yes/no): ")
    if confirm.lower() == 'yes':
        db.delete_collection()
        print(f"✓ Collection '{collection_name}' deleted successfully!\n")
    else:
        print("Deletion cancelled.\n")

def main():
    print("\n" + "="*60)
    print("Milvus Cloud Collection Manager")
    print("="*60)
    
    collections = list_all_collections()
    
    if not collections:
        print("No collections found. You can create a new one.")
        return
    
    print("\nOptions:")
    print("1. Delete a specific collection")
    print("2. Exit")
    
    choice = input("\nEnter your choice (1-2): ").strip()
    
    if choice == "1":
        if collections:
            print("\nEnter the collection name to delete:")
            for i, collection in enumerate(collections, 1):
                print(f"{i}. {collection}")
            
            collection_input = input("\nCollection name (or number): ").strip()
            
            # Check if input is a number
            if collection_input.isdigit():
                idx = int(collection_input) - 1
                if 0 <= idx < len(collections):
                    collection_name = collections[idx]
                else:
                    print("Invalid collection number!")
                    return
            else:
                collection_name = collection_input
            
            if collection_name in collections:
                delete_collection(collection_name)
                # Show updated list
                list_all_collections()
            else:
                print(f"Collection '{collection_name}' not found!")
    elif choice == "2":
        print("\nExiting...")
    else:
        print("\nInvalid choice!")

if __name__ == "__main__":
    main()
