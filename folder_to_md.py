import os

# --- CONFIGURATION ---
# The directory you want to scan ('.' means current directory)
ROOT_DIR = '.' 
# The output file name
OUTPUT_FILE = 'project_listing.md'

# Folders to completely ignore
IGNORE_DIRS = {'.git', '__pycache__', 'node_modules', 'venv', '.venv', 'build', 'dist', '.idea', '.vscode'}
# File extensions to ignore (images, binaries, etc.)
IGNORE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pyc', '.exe', '.dll', '.so', '.bin', '.pdf', '.zip', '.glb', '.mp3', '.wav'}
# Specific filenames to ignore
IGNORE_FILES = {'.DS_Store', 'package-lock.json', 'yarn.lock', OUTPUT_FILE}

def generate_tree(startpath):
    """Generates a visual ASCII tree structure of the directory."""
    tree_str = f"# Project Structure\n\nroot: {os.path.abspath(startpath)}\n"
    
    for root, dirs, files in os.walk(startpath):
        # Modify dirs in-place to skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        level = root.replace(startpath, '').count(os.sep)
        indent = ' ' * 4 * (level)
        tree_str += f"{indent}|-- {os.path.basename(root)}/\n"
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            if not any(f.endswith(ext) for ext in IGNORE_EXTENSIONS) and f not in IGNORE_FILES:
                tree_str += f"{subindent}|-- {f}\n"
    
    return tree_str + "\n---\n"

def is_binary(file_path):
    """Checks if a file is non-textual by attempting to read it with common encodings."""
    try:
        # 1. Try to read using the standard, most reliable encoding for web/code
        with open(file_path, 'r', encoding='utf-8') as check_file:
            check_file.read(1024 * 10) # Read first 10KB
            return False
    except UnicodeDecodeError:
        # If UTF-8 fails, try to read using a forgiving universal encoding
        try:
            with open(file_path, 'r', encoding='latin-1') as check_file:
                check_file.read(1024 * 10)
                return False
        except Exception:
             # If both fail, assume binary or unreadable
             return True
    except Exception:
        # Catches other OS/IO errors
        return True

def create_listing(root_dir, output_file):
    """Walks the directory and writes the content to the output file."""
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        
        # 1. Write the Tree Structure
        print("Generating tree structure...")
        outfile.write(generate_tree(root_dir))
        
        outfile.write("\n# File Contents\n\n")

        # 2. Walk and Write File Contents
        for root, dirs, files in os.walk(root_dir):
            # Skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

            for file in files:
                # Skip ignored extensions and specific files
                if any(file.endswith(ext) for ext in IGNORE_EXTENSIONS) or file in IGNORE_FILES:
                    continue

                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, root_dir)

                print(f"Processing: {relative_path}")

                outfile.write(f"## File: {relative_path}\n")
                
                # Detect language for markdown code block syntax highlighting
                ext = os.path.splitext(file)[1].lower().replace('.', '')
                # Default to plain text if extension is weird or missing
                lang = ext if ext else 'text' 

                outfile.write(f"```{lang}\n")
                
                if is_binary(file_path):
                     outfile.write("[Binary or Non-text file content omitted]\n")
                else:
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            outfile.write(f.read())
                    except Exception as e:
                        outfile.write(f"[Error reading file: {e}]\n")
                
                outfile.write("\n```\n\n")
                outfile.write("---\n\n")

    print(f"\nDone! Output written to: {output_file}")

if __name__ == "__main__":
    create_listing(ROOT_DIR, OUTPUT_FILE)