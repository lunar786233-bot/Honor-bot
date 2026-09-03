async function main() {
  const token = 'e5e63698-b03e-4644-897a-b29baad9dbb5';
  const query = `
    query {
      project(id: "a53b5de4-24ab-4593-884f-82037bc559d7") {
        id
        name
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
        services {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: {
      'project-access-token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  console.log('Project Data:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
