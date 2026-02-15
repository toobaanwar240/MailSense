import re

def truncate_email_content(email_content, max_tokens=5000):
    max_chars = int(max_tokens * 3.5)
    truncated = False

    if len(email_content) > max_chars:
        email_content = email_content[:max_chars] + "... [content truncated]"
        truncated = True

    return email_content, truncated


def clean_email_content(email_content):
    lines = email_content.split('\n')
    cleaned_lines = []
    in_quoted_section = False

    for line in lines:
        line_stripped = line.strip()

        if line_stripped.startswith(('>', 'On', 'From:', 'Sent:', 'To:', 'Subject:')):
            in_quoted_section = True
            continue
        elif in_quoted_section and line_stripped == '':
            in_quoted_section = False
            continue

        if not in_quoted_section:
            cleaned_lines.append(line)

    cleaned_content = '\n'.join(cleaned_lines)
    cleaned_content = re.sub(r'\n\s*\n', '\n\n', cleaned_content)
    cleaned_content = re.sub(r'[ \t]+', ' ', cleaned_content)

    return cleaned_content.strip()


def preprocess_email(email_content, max_tokens=5000):
    cleaned = clean_email_content(email_content)
    processed, truncated = truncate_email_content(cleaned, max_tokens)
    return processed, truncated
