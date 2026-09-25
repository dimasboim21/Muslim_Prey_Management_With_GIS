(function (window, document) {
  "use strict";

  var form = document.getElementById("mosqueInputForm");
  var status = document.getElementById("mosqueInputStatus");
  var list = document.getElementById("mosqueList");
  var resetButton = document.getElementById("resetFormButton");
  var refreshButton = document.getElementById("refreshListButton");

  if (!form) {
    return;
  }

  function resetForm() {
    form.reset();
    var idInput = form.querySelector("input[name='id']");
    if (idInput) {
      idInput.value = "";
    }
    var countryInput = form.querySelector("input[name='country']");
    if (countryInput) {
      countryInput.value = "Indonesia";
    }
    var timezoneInput = form.querySelector("input[name='timezone']");
    if (timezoneInput) {
      timezoneInput.value = "Asia/Jakarta";
    }
  }

  function setStatus(message) {
    if (status) {
      status.textContent = "Status: " + message;
    }
  }

  function notifyDashboardRefresh() {
    try {
      window.localStorage.setItem("mpm:mosque-updated", String(Date.now()));
    } catch (error) {
      // Ignore storage failures and fall back to local event dispatch.
    }
    window.dispatchEvent(new window.CustomEvent("mpm:mosque-updated"));
  }

  function loadRecords() {
    if (!list) {
      return;
    }

    list.innerHTML = "<p>Memuat data...</p>";
    window.fetch("api/mosque-admin.php", { method: "GET" })
      .then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok || !json || json.success === false) {
            throw new Error((json && json.error) || "Gagal memuat data.");
          }
          return json.data || [];
        });
      })
      .then(function (records) {
        if (!records.length) {
          list.innerHTML = "<p>Belum ada data masjid tersimpan.</p>";
          return;
        }

        list.innerHTML = records.map(function (record) {
          return '<article class="mosque-item">' +
            '<h3>' + window.escapeHtml(record.mosque_name || "-" ) + '</h3>' +
            '<p>' + window.escapeHtml([record.country, record.province, record.city].filter(Boolean).join(" - ")) + '</p>' +
            '<p>Zona waktu: ' + window.escapeHtml(record.timezone || "-") + '</p>' +
            '<p>Hijriah: ' + window.escapeHtml(record.hijri_date_manual || "-") + '</p>' +
            '<div class="mosque-item-actions">' +
            '<button type="button" data-action="edit" data-id="' + record.mosque_id + '">Edit</button>' +
            '<button type="button" data-action="delete" data-id="' + record.mosque_id + '">Hapus</button>' +
            '</div></article>';
        }).join("");
      })
      .catch(function (error) {
        list.innerHTML = "<p>Gagal memuat data.</p>";
        setStatus(error.message);
      });
  }

  function fillForm(record) {
    var idInput = form.querySelector("input[name='id']");
    if (idInput) {
      idInput.value = record.mosque_id || "";
    }
    form.querySelector("input[name='country']").value = record.country || "Indonesia";
    form.querySelector("input[name='province']").value = record.province || "";
    form.querySelector("input[name='city']").value = record.city || "";
    form.querySelector("input[name='mosqueName']").value = record.mosque_name || "";
    form.querySelector("input[name='timezone']").value = record.timezone || "Asia/Jakarta";
    form.querySelector("input[name='hijriDate']").value = record.hijri_date_manual || "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var formData = new FormData(form);
    var payload = {
      id: formData.get("id") || "",
      country: formData.get("country") || "",
      province: formData.get("province") || "",
      city: formData.get("city") || "",
      mosqueName: formData.get("mosqueName") || "",
      timezone: formData.get("timezone") || "Asia/Jakarta",
      hijriDate: formData.get("hijriDate") || ""
    };

    setStatus("menyimpan...");

    var method = payload.id ? "PUT" : "POST";
    window.fetch("api/mosque-admin.php", {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().then(function (json) {
        if (!response.ok || !json || json.success === false) {
          throw new Error((json && json.error) || "Gagal menyimpan data.");
        }
        return json;
      });
    }).then(function () {
      setStatus("data berhasil disimpan ke database.");
      resetForm();
      loadRecords();
      notifyDashboardRefresh();
    }).catch(function (error) {
      setStatus(error.message);
    });
  });

  if (resetButton) {
    resetButton.addEventListener("click", resetForm);
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", loadRecords);
  }

  list.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var action = button.getAttribute("data-action");
    var id = button.getAttribute("data-id");

    if (action === "edit") {
      window.fetch("api/mosque-admin.php?id=" + encodeURIComponent(id), { method: "GET" })
        .then(function (response) {
          return response.json().then(function (json) {
            if (!response.ok || !json || json.success === false) {
              throw new Error((json && json.error) || "Gagal memuat data.");
            }
            return json.data || [];
          });
        })
        .then(function (records) {
          var selected = records.find(function (record) {
            return String(record.mosque_id) === String(id);
          });
          if (selected) {
            fillForm(selected);
            setStatus("data siap diedit.");
          }
        })
        .catch(function (error) {
          setStatus(error.message);
        });
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Hapus data masjid ini?")) {
        return;
      }
      window.fetch("api/mosque-admin.php", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id })
      }).then(function (response) {
        return response.json().then(function (json) {
          if (!response.ok || !json || json.success === false) {
            throw new Error((json && json.error) || "Gagal menghapus data.");
          }
          return json;
        });
      }).then(function () {
        setStatus("data berhasil dihapus.");
        loadRecords();
        notifyDashboardRefresh();
      }).catch(function (error) {
        setStatus(error.message);
      });
    }
  });

  window.escapeHtml = function (value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  loadRecords();
  resetForm();
})(window, document);
