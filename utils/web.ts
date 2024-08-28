export function markdownToHTML(title: string, markdown: string) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/2.0.3/marked.min.js"></script>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f0f4f8;
            color: #333;
            font-size: 14px;
        }
        .container {
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            border-radius: 8px;
            height: calc(100% - 40px);
            overflow: auto;
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2em;
        }
        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-bottom: 20px;
            font-size: 0.9em;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        th {
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        tr:hover {
            background-color: #e6f3ff;
        }
        .summary {
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            font-style: italic;
            margin-top: 20px;
            font-size: 0.9em;
        }
        .copied {
            background-color: #2ecc71 !important;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="markdown-content"></div>
    </div>

    <script>
        const markdownText = \`${markdown}\`;
        document.getElementById('markdown-content').innerHTML = marked(markdownText);

        function fallbackCopyTextToClipboard(text) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            
            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');
                console.log('Fallback: Copying text command was ' + (successful ? 'successful' : 'unsuccessful'));
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }

            document.body.removeChild(textArea);
        }

        function copyToClipboard(text) {
            if (!navigator.clipboard) {
                fallbackCopyTextToClipboard(text);
                return;
            }
            navigator.clipboard.writeText(text).then(function() {
                console.log('Async: Copying to clipboard was successful!');
            }, function(err) {
                console.error('Async: Could not copy text: ', err);
                fallbackCopyTextToClipboard(text);
            });
        }

        function handleCellClick(event) {
            const cell = event.target;
            const originalText = cell.textContent;
            const originalBg = cell.style.backgroundColor;
            const originalColor = cell.style.color;

            copyToClipboard(originalText);

            cell.classList.add('copied');
            cell.textContent = '已复制!';

            setTimeout(() => {
                cell.classList.remove('copied');
                cell.textContent = originalText;
                cell.style.backgroundColor = originalBg;
                cell.style.color = originalColor;
            }, 1000);
        }

        document.querySelectorAll('table td, table th').forEach(cell => {
            cell.addEventListener('click', handleCellClick);
        });
    </script>
</body>
</html>`;
}
export function jsonArrayToMarkdownTable(jsonArray: any[]): string {
  if (jsonArray.length === 0) {
    return '空数组，无法生成表格。';
  }

  // 获取所有唯一的键
  const keys = Array.from(
    new Set(jsonArray.flatMap((obj) => Object.keys(obj))),
  );

  // 创建表头
  let markdownTable = '| ' + keys.join(' | ') + ' |\n';
  markdownTable += '|' + keys.map(() => '---').join('|') + '|\n';

  // 添加数据行
  jsonArray.forEach((obj) => {
    const row = keys.map((key) => {
      let value = obj[key] !== undefined ? obj[key] : '';
      if (typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      // 转义表格中的管道符号
      return String(value).replace(/\|/g, '\\|');
    });
    markdownTable += '| ' + row.join(' | ') + ' |\n';
  });

  return markdownTable;
}
