import { useEffect, useState } from "react";
import API from "../../api";

export default function StudyMaterialStudent({
  teachingId,
}) {

  // ================= STATES =================
  const [materials, setMaterials] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  // ✅ SEARCH
  const [search, setSearch] =
    useState("");

  // ================= FETCH =================
  const fetchMaterials = async () => {

    try {

      const res = await API.get(
        `/study-materials/?teaching_assignment=${teachingId}`
      );

      setMaterials(
        res.data?.results ||
        res.data ||
        []
      );

    } catch (err) {

      console.log(
        "Material fetch error:",
        err
      );

    } finally {

      setLoading(false);
    }
  };

  // ================= LOAD =================
  useEffect(() => {

    if (teachingId) {

      fetchMaterials();
    }

  }, [teachingId]);

  // ================= FILTERED MATERIALS =================
  const filteredMaterials =
    materials.filter((m) => {

      return (

        m.title
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          )

        ||

        m.description
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          )

        ||

        m.uploaded_by_name
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          )
      );
    });

  return (
    <div className="card">

      {/* ================= HEADER ================= */}
      <div
        style={{
          marginBottom: "20px",
        }}
      >

        <h2>
          Study Materials
        </h2>

        <p>
          View and download notes
        </p>

      </div>

      {/* ================= SEARCH ================= */}
      <div
        style={{
          marginBottom: "20px",
        }}
      >

        <input
          type="text"
          placeholder="Search materials..."
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          style={{
            width: "100%",
            maxWidth: "350px",
          }}
        />

      </div>

      {/* ================= LOADING ================= */}
      {loading ? (

        <p>
          Loading materials...
        </p>

      ) : filteredMaterials.length === 0 ? (

        <p>
          No study materials found
        </p>

      ) : (

        <div
          style={{
            overflowX: "auto",
          }}
        >

          <table>

            <thead>

              <tr>

                <th>
                  Title
                </th>

                <th>
                  Description
                </th>

                <th>
                  Uploaded By
                </th>

                <th>
                  Date
                </th>

                <th>
                  Action
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredMaterials.map(
                (m) => (

                  <tr
                    key={m.id}
                  >

                    {/* TITLE */}
                    <td>
                      {m.title}
                    </td>

                    {/* DESCRIPTION */}
                    <td>
                      {m.description ||
                        "-"}
                    </td>

                    {/* TEACHER */}
                    <td>
                      {
                        m.uploaded_by_name
                      }
                    </td>

                    {/* DATE */}
                    <td>

                      {m.created_at

                        ? new Date(
                            m.created_at
                          ).toLocaleDateString()

                        : "-"}

                    </td>

                    {/* ACTION */}
                    <td>

                      {m.file ? (

                        <a
                          href={m.file}
                          target="_blank"
                          rel="noreferrer"
                        >

                          <button
                            className="btn-primary"
                          >
                            View Material
                          </button>

                        </a>

                      ) : (

                        <span>
                          No file
                        </span>

                      )}

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      )}

    </div>
  );
}