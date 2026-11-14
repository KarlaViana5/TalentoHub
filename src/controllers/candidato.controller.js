
const candidatoController = {

    mostrarInicio: (req, res) => {
        res.render('candidato/index', {
            titulo: 'Módulo de candidato',
            descripcion: 'Gestiona tu perfil profesional, postulaciones y metas de empleo.'
        });
    }

};

module.exports = candidatoController;
